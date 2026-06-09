use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub active_file: Mutex<Option<String>>,
    pub active_window_label: Mutex<Option<String>>,
    pub pending_open_files: Mutex<Vec<String>>,
}
