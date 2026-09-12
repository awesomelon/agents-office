use super::observer::Observer;
use super::session_monitor::SessionMonitor;
use crate::models::{AppEvent, WatcherState};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

pub struct SharedObserver(pub Mutex<Observer>);

pub fn sessions_dir() -> Result<PathBuf, String> {
    let codex_home = std::env::var_os("CODEX_HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".codex")))
        .ok_or_else(|| "Could not resolve the Codex home directory".to_owned())?;
    Ok(codex_home.join("sessions"))
}

/// Polling is intentional: it handles missing folders, nested new date folders,
/// filesystem event loss and large write bursts using the same bounded reader.
pub fn start_watching(app: AppHandle) {
    let root = match sessions_dir() {
        Ok(root) => root,
        Err(_) => {
            let shared = app.state::<SharedObserver>();
            if let Ok(mut observer) = shared.0.lock() {
                emit(
                    &app,
                    observer.set_status(
                        WatcherState::Error,
                        "Could not resolve the Codex home directory.",
                    ),
                );
            }
            return;
        }
    };
    let mut monitor = SessionMonitor::new(root);
    let mut last_discovery = Instant::now() - Duration::from_secs(3);
    loop {
        let discover = last_discovery.elapsed() >= Duration::from_secs(3);
        let result = monitor.poll(discover);
        if discover {
            last_discovery = Instant::now();
        }
        let shared = app.state::<SharedObserver>();
        match shared.0.lock() {
            Ok(mut observer) => {
                // Updating state before emitting lets a late listener hydrate the
                // exact same revision from get_observer_snapshot atomically.
                emit(&app, observer.set_status(result.state, result.message));
                emit(&app, observer.push(result.logs, result.agents));
            }
            Err(_) => {
                tracing::error!("Observer state lock is unavailable");
                return;
            }
        }
        std::thread::sleep(Duration::from_millis(500));
    }
}

fn emit(app: &AppHandle, event: Option<AppEvent>) {
    if let Some(event) = event {
        if app.emit("app-event", event).is_err() {
            // Never write session data or raw rollout errors to diagnostic logs.
            tracing::warn!("Could not deliver an observer event to the desktop window");
        }
    }
}
