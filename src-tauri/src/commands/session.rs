use std::{fs, path::PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::file::CommandResult;

#[tauri::command]
pub fn load_session() -> CommandResult<Option<Value>> {
    let path = session_path();
    if !path.exists() {
        return ok(None);
    }

    match fs::read_to_string(&path)
        .map_err(|error| format!("failed to read session: {error}"))
        .and_then(|content| {
            serde_json::from_str(&content)
                .map_err(|error| format!("failed to parse session: {error}"))
        }) {
        Ok(session) => ok(Some(session)),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn save_session(session: Value) -> CommandResult<Option<()>> {
    let path = session_path();
    if let Some(parent) = path.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            return fail(format!("failed to create session directory: {error}"));
        }
    }

    match serde_json::to_string_pretty(&session)
        .map_err(|error| format!("failed to serialize session: {error}"))
        .and_then(|content| {
            fs::write(&path, content).map_err(|error| format!("failed to write session: {error}"))
        }) {
        Ok(()) => ok(Some(())),
        Err(error) => fail(error),
    }
}

fn session_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Saekim")
        .join("session.json")
}

fn ok<T>(data: T) -> CommandResult<T>
where
    T: Serialize,
{
    CommandResult {
        success: true,
        data: Some(data),
        error: None,
    }
}

fn fail<T>(error: String) -> CommandResult<T>
where
    T: Serialize,
{
    CommandResult {
        success: false,
        data: None,
        error: Some(error),
    }
}
