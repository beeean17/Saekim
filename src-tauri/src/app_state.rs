use rusqlite::Connection;
use std::{
    collections::HashSet,
    sync::{atomic::AtomicBool, Mutex},
};

#[derive(Default)]
pub struct AppState {
    pub active_file: Mutex<Option<String>>,
    pub active_window_label: Mutex<Option<String>>,
    pub pending_open_files: Mutex<Vec<String>>,
    pub metadata_connection: Mutex<Option<Connection>>,
    pub approved_close_windows: Mutex<HashSet<String>>,
    pub pending_exit_windows: Mutex<Option<HashSet<String>>>,
    pub app_exit_approved: AtomicBool,
}
