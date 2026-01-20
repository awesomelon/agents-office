mod commands;
mod models;
mod watcher;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Start the log watcher in a background task
            tauri::async_runtime::spawn_blocking(move || {
                if let Err(e) = watcher::start_watching(handle) {
                    tracing::error!("Failed to start log watcher: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_claude_home,
            commands::get_agents,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
