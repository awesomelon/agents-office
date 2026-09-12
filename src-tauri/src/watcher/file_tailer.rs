use std::fs::{File, Metadata};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::Path;

pub const MAX_LINE_BYTES: usize = 256 * 1024;
const ANCHOR_BYTES: usize = 64;

#[derive(Default)]
pub struct FileTailer {
    position: u64,
    partial: Vec<u8>,
    discard_line: bool,
    anchor: Vec<u8>,
    identity: Option<(u64, u64)>,
}

#[derive(Default)]
pub struct TailRead {
    pub lines: Vec<String>,
    pub bytes_read: usize,
    pub reset: bool,
    pub skipped_lines: usize,
}

impl FileTailer {
    /// Existing logs start at EOF. A trailing fragment belongs to history and is
    /// discarded through its next newline, including split UTF-8 code points.
    pub fn baseline(path: &Path) -> io::Result<Self> {
        let mut file = File::open(path)?;
        let metadata = file.metadata()?;
        let mut tailer = Self {
            position: metadata.len(),
            identity: file_identity(&metadata),
            ..Self::default()
        };
        tailer.refresh_anchor(&mut file)?;
        tailer.discard_line = tailer.anchor.last().is_some_and(|byte| *byte != b'\n');
        Ok(tailer)
    }

    pub fn read(
        &mut self,
        path: &Path,
        byte_limit: usize,
        line_limit: usize,
    ) -> io::Result<TailRead> {
        let mut file = File::open(path)?;
        let metadata = file.metadata()?;
        let identity = file_identity(&metadata);
        let mut result = TailRead::default();
        let replaced = self.identity.is_some() && identity != self.identity;
        let changed = metadata.len() < self.position || !self.anchor_matches(&mut file)?;
        if replaced || changed {
            *self = Self::default();
            result.reset = true;
        }
        self.identity = identity;
        file.seek(SeekFrom::Start(self.position))?;
        let mut buffer = [0_u8; 16 * 1024];
        while result.bytes_read < byte_limit && result.lines.len() < line_limit {
            let capacity = buffer.len().min(byte_limit - result.bytes_read);
            let count = file.read(&mut buffer[..capacity])?;
            if count == 0 {
                break;
            }
            let mut consumed = 0;
            for &byte in &buffer[..count] {
                consumed += 1;
                if byte == b'\n' {
                    if self.discard_line {
                        self.discard_line = false;
                    } else {
                        let mut bytes = std::mem::take(&mut self.partial);
                        if bytes.last() == Some(&b'\r') {
                            bytes.pop();
                        }
                        match String::from_utf8(bytes) {
                            Ok(line) if !line.is_empty() => result.lines.push(line),
                            Ok(_) => {}
                            Err(_) => result.skipped_lines += 1,
                        }
                    }
                } else if !self.discard_line {
                    if self.partial.len() >= MAX_LINE_BYTES {
                        self.partial.clear();
                        self.discard_line = true;
                        result.skipped_lines += 1;
                    } else {
                        self.partial.push(byte);
                    }
                }
                if result.lines.len() >= line_limit {
                    break;
                }
            }
            self.position += consumed as u64;
            result.bytes_read += consumed;
            if consumed < count {
                break;
            }
        }
        self.refresh_anchor(&mut file)?;
        Ok(result)
    }

    fn anchor_matches(&self, file: &mut File) -> io::Result<bool> {
        if self.anchor.is_empty() {
            return Ok(true);
        }
        file.seek(SeekFrom::Start(self.position - self.anchor.len() as u64))?;
        let mut current = vec![0; self.anchor.len()];
        match file.read_exact(&mut current) {
            Ok(()) => Ok(current == self.anchor),
            Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => Ok(false),
            Err(error) => Err(error),
        }
    }

    fn refresh_anchor(&mut self, file: &mut File) -> io::Result<()> {
        let size = self.position.min(ANCHOR_BYTES as u64) as usize;
        file.seek(SeekFrom::Start(self.position - size as u64))?;
        self.anchor.resize(size, 0);
        file.read_exact(&mut self.anchor)
    }
}

#[cfg(unix)]
fn file_identity(metadata: &Metadata) -> Option<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    Some((metadata.dev(), metadata.ino()))
}

#[cfg(not(unix))]
fn file_identity(_: &Metadata) -> Option<(u64, u64)> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};

    struct Fixture(PathBuf);
    impl Fixture {
        fn new(bytes: &[u8]) -> Self {
            static NEXT: AtomicUsize = AtomicUsize::new(0);
            let path = std::env::temp_dir().join(format!(
                "codex-office-{}-{}.jsonl",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::write(&path, bytes).unwrap();
            Self(path)
        }
        fn append(&self, bytes: &[u8]) {
            std::fs::OpenOptions::new()
                .append(true)
                .open(&self.0)
                .unwrap()
                .write_all(bytes)
                .unwrap();
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    #[test]
    fn baseline_ignores_history_and_partial_historical_line() {
        let file = Fixture::new(b"old\npartial");
        let mut tailer = FileTailer::baseline(&file.0).unwrap();
        file.append(b" history\nfresh\n");
        assert_eq!(tailer.read(&file.0, 1024, 10).unwrap().lines, vec!["fresh"]);
        assert!(tailer.read(&file.0, 1024, 10).unwrap().lines.is_empty());
    }

    #[test]
    fn utf8_split_across_appends_survives() {
        let file = Fixture::new(&[0xed, 0x95]);
        let mut tailer = FileTailer::default();
        assert!(tailer.read(&file.0, 1024, 10).unwrap().lines.is_empty());
        file.append(&[0x9c, b'\n']);
        assert_eq!(tailer.read(&file.0, 1024, 10).unwrap().lines, vec!["한"]);
    }

    #[test]
    fn truncation_and_same_size_replacement_reset_position() {
        let file = Fixture::new(b"before\n");
        let mut tailer = FileTailer::baseline(&file.0).unwrap();
        std::fs::write(&file.0, b"after!\n").unwrap();
        let read = tailer.read(&file.0, 1024, 10).unwrap();
        assert!(read.reset);
        assert_eq!(read.lines, vec!["after!"]);
        std::fs::write(&file.0, b"x\n").unwrap();
        assert_eq!(tailer.read(&file.0, 1024, 10).unwrap().lines, vec!["x"]);
    }

    #[test]
    fn bounded_batches_drain_without_loss_or_duplicates() {
        let file = Fixture::new(b"one\ntwo\nthree\nfour\n");
        let mut tailer = FileTailer::default();
        let mut lines = Vec::new();
        for _ in 0..20 {
            let read = tailer.read(&file.0, 3, 1).unwrap();
            assert!(read.bytes_read <= 3);
            assert!(read.lines.len() <= 1);
            lines.extend(read.lines);
        }
        assert_eq!(lines, vec!["one", "two", "three", "four"]);
    }

    #[test]
    fn oversized_and_invalid_lines_are_skipped_then_recover() {
        let mut bytes = vec![b'x'; MAX_LINE_BYTES + 100];
        bytes.extend_from_slice(&[b'\n', 0xff, b'\n']);
        bytes.extend_from_slice(b"valid\n");
        let file = Fixture::new(&bytes);
        let mut tailer = FileTailer::default();
        let mut lines = Vec::new();
        let mut skipped = 0;
        for _ in 0..10 {
            let read = tailer.read(&file.0, 64 * 1024, 10).unwrap();
            assert!(tailer.partial.len() <= MAX_LINE_BYTES);
            skipped += read.skipped_lines;
            lines.extend(read.lines);
        }
        assert_eq!(skipped, 2);
        assert_eq!(lines, vec!["valid"]);
    }
}
