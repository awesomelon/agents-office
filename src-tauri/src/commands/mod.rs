use crate::models::{Agent, ObserverSnapshot, WatcherStatus};
use crate::watcher::{sessions_dir, SharedObserver};

#[tauri::command]
pub fn get_codex_home() -> Result<String, String> {
    sessions_dir()?
        .parent()
        .map(|path| path.to_string_lossy().into_owned())
        .ok_or_else(|| "Could not resolve the Codex home directory".into())
}

#[tauri::command]
pub fn get_observer_snapshot(
    state: tauri::State<'_, SharedObserver>,
) -> Result<ObserverSnapshot, String> {
    state
        .0
        .lock()
        .map(|observer| observer.snapshot())
        .map_err(|_| "Observer state is unavailable".into())
}

#[tauri::command]
pub fn get_watcher_status(
    state: tauri::State<'_, SharedObserver>,
) -> Result<WatcherStatus, String> {
    get_observer_snapshot(state).map(|snapshot| snapshot.watcher)
}

#[tauri::command]
pub fn get_agents(state: tauri::State<'_, SharedObserver>) -> Result<Vec<Agent>, String> {
    get_observer_snapshot(state).map(|snapshot| snapshot.agents)
}
