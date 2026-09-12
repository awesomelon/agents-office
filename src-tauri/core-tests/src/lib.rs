// Test the actual desktop core without building GTK/WebKit/Tauri.
#[path = "../../src/watcher/file_tailer.rs"]
pub mod file_tailer;
#[path = "../../src/watcher/log_parser.rs"]
pub mod log_parser;
#[path = "../../src/models/mod.rs"]
pub mod models;
#[path = "../../src/watcher/observer.rs"]
pub mod observer;
#[path = "../../src/watcher/session_monitor.rs"]
pub mod session_monitor;
