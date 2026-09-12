mod commands;
mod models;
mod watcher;

use std::sync::Mutex;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let path = watcher::sessions_dir()
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_default();
    tauri::Builder::default()
        .manage(watcher::SharedObserver(Mutex::new(watcher::Observer::new(
            path,
        ))))
        .setup(|app| {
            let handle = app.handle().clone();
            // A detached OS thread exits with the process; a never-ending blocking
            // runtime task would otherwise delay runtime shutdown.
            std::thread::Builder::new()
                .name("codex-rollout-observer".into())
                .spawn(move || watcher::start_watching(handle))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_codex_home,
            commands::get_agents,
            commands::get_watcher_status,
            commands::get_observer_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Codex Office");
}
