use std::{
    fs,
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
    sync::MutexGuard,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Manager;

use super::file::CommandResult;
use crate::app_state::AppState;

pub(super) const SCHEMA_VERSION: i64 = 3;
const DEFAULT_WORKSPACE_ID: &str = "ws_default";
const DEFAULT_VIEW_ID: &str = "view_default";
const LEGACY_DRAFT_WINDOW: &str = "__legacy__";

#[tauri::command]
pub fn load_session(app: tauri::AppHandle, window: tauri::Window) -> CommandResult<Option<Value>> {
    match load_session_from_metadata(&app, window.label()).or_else(|_| load_legacy_session()) {
        Ok(session) => ok(session),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn save_session(
    app: tauri::AppHandle,
    window: tauri::Window,
    session: Value,
    scope: SessionSaveScope,
) -> CommandResult<Option<()>> {
    match save_session_to_metadata(&app, window.label(), &session, scope) {
        Ok(()) => ok(Some(())),
        Err(error) => fail(error),
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionSaveScope {
    Ui,
    Documents,
}

#[tauri::command]
pub fn delete_document_draft(
    app: tauri::AppHandle,
    window: tauri::Window,
    file_path: String,
) -> CommandResult<Option<()>> {
    match delete_document_draft_from_metadata(&app, window.label(), &file_path) {
        Ok(()) => ok(Some(())),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn load_workspace_session(
    app: tauri::AppHandle,
    window: tauri::Window,
    workspace_path: String,
) -> CommandResult<Option<Value>> {
    match load_workspace_session_from_metadata(&app, window.label(), &workspace_path) {
        Ok(session) => ok(session),
        Err(error) => fail(error),
    }
}

fn load_session_from_metadata(
    app: &tauri::AppHandle,
    window_label: &str,
) -> Result<Option<Value>, String> {
    let connection = open_metadata_connection(app)?;
    let Some(context) = load_window_session_context(&connection, window_label)? else {
        return Ok(None);
    };

    load_session_for_context(app, &connection, window_label, context).map(Some)
}

struct WindowSessionContext {
    saved_at: String,
    workspace_id: String,
    view_id: String,
    active_file_id: Option<String>,
    ui: Value,
    settings: Value,
}

fn load_window_session_context(
    connection: &Connection,
    window_label: &str,
) -> Result<Option<WindowSessionContext>, String> {
    let context = connection
        .query_row(
            "SELECT saved_at, workspace_id, workspace_view_id, active_file_id, ui_json, settings_json
             FROM workspace_windows
             WHERE window_label = ?1",
            params![window_label],
            |row| {
                let ui_json: String = row.get(4)?;
                let settings_json: String = row.get(5)?;
                Ok(WindowSessionContext {
                    saved_at: row.get(0)?,
                    workspace_id: row.get(1)?,
                    view_id: row.get(2)?,
                    active_file_id: row.get(3)?,
                    ui: parse_json_value(Some(&ui_json), default_ui()),
                    settings: parse_json_value(Some(&settings_json), default_settings()),
                })
            },
        )
        .optional()
        .map_err(|error| format!("failed to load window session metadata: {error}"))?;

    if context.is_some() {
        return Ok(context);
    }

    load_legacy_window_session_context(connection)
}

fn load_legacy_window_session_context(
    connection: &Connection,
) -> Result<Option<WindowSessionContext>, String> {
    let Some(saved_at) = metadata_value(connection, "saved_at")? else {
        return Ok(None);
    };

    let workspace_id = metadata_value(connection, "active_workspace_id")?
        .unwrap_or_else(|| DEFAULT_WORKSPACE_ID.to_string());
    let view_id = metadata_value(connection, "active_view_id")?
        .unwrap_or_else(|| DEFAULT_VIEW_ID.to_string());
    let active_file_id = metadata_value(connection, "active_file_id")?;
    let settings = parse_json_value(
        metadata_value(connection, "settings_json")?.as_deref(),
        default_settings(),
    );

    Ok(Some(WindowSessionContext {
        saved_at,
        workspace_id,
        view_id,
        active_file_id,
        ui: default_ui(),
        settings,
    }))
}

fn load_session_for_context(
    app: &tauri::AppHandle,
    connection: &Connection,
    window_label: &str,
    context: WindowSessionContext,
) -> Result<Value, String> {
    let workspace_row = connection
        .query_row(
            "SELECT canonical_root_path FROM workspaces WHERE id = ?1",
            params![context.workspace_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to load workspace metadata: {error}"))?;

    let view_row = connection
        .query_row(
            "SELECT view_root_relative_path, layout_json, tree_json FROM workspace_views WHERE id = ?1",
            params![context.view_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|error| format!("failed to load workspace view metadata: {error}"))?;

    let (root_path, ui, tree) = match (workspace_row, view_row) {
        (Some(canonical_root_path), Some((view_relative_path, layout_json, tree_json))) => (
            Some(resolve_view_root(&canonical_root_path, &view_relative_path)),
            parse_json_value(layout_json.as_deref(), context.ui),
            parse_json_value(tree_json.as_deref(), json!([])),
        ),
        _ => (None, context.ui, json!([])),
    };

    let open_files = load_open_files(
        app,
        connection,
        window_label,
        &context.workspace_id,
        &context.view_id,
    )?;
    let recent_workspaces = load_recent_workspaces(connection)?;

    Ok(json!({
        "version": 3,
        "savedAt": context.saved_at,
        "window": {
            "id": window_label,
            "label": window_label,
        },
        "workspace": {
            "rootPath": root_path,
            "tree": tree,
            "openFiles": open_files,
            "activeFileId": context.active_file_id,
        },
        "recentWorkspaces": recent_workspaces,
        "ui": ui,
        "settings": context.settings,
    }))
}

fn load_workspace_session_from_metadata(
    app: &tauri::AppHandle,
    window_label: &str,
    workspace_path: &str,
) -> Result<Option<Value>, String> {
    let connection = open_metadata_connection(app)?;
    let canonical_root_path = workspace_path.trim();
    if canonical_root_path.is_empty() {
        return Ok(None);
    }

    let workspace_id = stable_id("ws", canonical_root_path);
    let Some((view_id, active_file_id)) =
        preferred_workspace_view(&connection, window_label, &workspace_id)?
    else {
        return Ok(Some(json!({
            "rootPath": canonical_root_path,
            "tree": [],
            "openFiles": [],
            "activeFileId": null,
        })));
    };

    let view_row = connection
        .query_row(
            "SELECT view_root_relative_path, tree_json FROM workspace_views WHERE id = ?1",
            params![view_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()
        .map_err(|error| format!("failed to load workspace view metadata: {error}"))?;

    let Some((view_relative_path, tree_json)) = view_row else {
        return Ok(None);
    };

    let root_path = resolve_view_root(canonical_root_path, &view_relative_path);
    let open_files = load_open_files(app, &connection, window_label, &workspace_id, &view_id)?;
    let active_file_id = match active_file_id {
        Some(active_file_id) => Some(active_file_id),
        None => active_file_id_for_window_workspace(&connection, window_label, &workspace_id)?,
    };

    Ok(Some(json!({
        "rootPath": root_path,
        "tree": parse_json_value(tree_json.as_deref(), json!([])),
        "openFiles": open_files,
        "activeFileId": active_file_id,
    })))
}

fn active_file_id_for_window_workspace(
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT state_json
             FROM window_file_view_state
             WHERE window_label = ?1 AND workspace_id = ?2 AND is_active = 1
             ORDER BY open_order ASC
             LIMIT 1",
            params![window_label, workspace_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to load active window file metadata: {error}"))
        .map(|state_json| {
            state_json.and_then(|value| {
                serde_json::from_str::<Value>(&value)
                    .ok()
                    .and_then(|file| file.get("id").and_then(Value::as_str).map(str::to_string))
            })
        })
}

fn preferred_workspace_view(
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
) -> Result<Option<(String, Option<String>)>, String> {
    let window_view = connection
        .query_row(
            "SELECT workspace_view_id, active_file_id
             FROM workspace_windows
             WHERE window_label = ?1 AND workspace_id = ?2",
            params![window_label, workspace_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()
        .map_err(|error| format!("failed to load window workspace view metadata: {error}"))?;

    if window_view.is_some() {
        return Ok(window_view);
    }

    connection
        .query_row(
            "SELECT id, NULL
             FROM workspace_views
             WHERE workspace_id = ?1
             ORDER BY last_opened_at DESC
             LIMIT 1",
            params![workspace_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()
        .map_err(|error| format!("failed to load recent workspace view metadata: {error}"))
}

fn save_session_to_metadata(
    app: &tauri::AppHandle,
    window_label: &str,
    session: &Value,
    scope: SessionSaveScope,
) -> Result<(), String> {
    let mut connection = open_metadata_connection(app)?;
    #[cfg(target_os = "macos")]
    let recent_workspace_snapshot_before =
        recent_workspace_menu_snapshot(&connection).unwrap_or_default();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("failed to start metadata transaction: {error}"))?;

    let now = current_timestamp_millis();
    let saved_at = session
        .get("savedAt")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| now.to_string());
    let workspace = session.get("workspace").unwrap_or(&Value::Null);
    let ui = session.get("ui").cloned().unwrap_or_else(default_ui);
    let settings = session
        .get("settings")
        .cloned()
        .unwrap_or_else(default_settings);
    let root_path = workspace.get("rootPath").and_then(Value::as_str);
    let open_files = workspace
        .get("openFiles")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let active_file_id = workspace
        .get("activeFileId")
        .and_then(Value::as_str)
        .map(str::to_string);
    let canonical_root_path = canonical_root_path(root_path, &open_files).unwrap_or_default();
    let workspace_id = if canonical_root_path.is_empty() {
        DEFAULT_WORKSPACE_ID.to_string()
    } else {
        stable_id("ws", &canonical_root_path)
    };
    let view_relative_path = root_path
        .map(|path| relative_path(&canonical_root_path, path))
        .unwrap_or_else(|| ".".to_string());
    let view_id = if canonical_root_path.is_empty() {
        DEFAULT_VIEW_ID.to_string()
    } else {
        stable_id("view", &format!("{workspace_id}:{view_relative_path}"))
    };
    let display_name = workspace_display_name(&canonical_root_path);
    let tree_json = serde_json::to_string(workspace.get("tree").unwrap_or(&json!([])))
        .map_err(|error| format!("failed to serialize workspace tree: {error}"))?;
    let ui_json = serde_json::to_string(&ui)
        .map_err(|error| format!("failed to serialize UI metadata: {error}"))?;
    let settings_json = serde_json::to_string(&settings)
        .map_err(|error| format!("failed to serialize settings metadata: {error}"))?;

    transaction
        .execute(
            "INSERT INTO workspaces (id, canonical_root_path, display_name, created_at, last_opened_at)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(id) DO UPDATE SET
               canonical_root_path = excluded.canonical_root_path,
               display_name = excluded.display_name,
               last_opened_at = excluded.last_opened_at",
            params![workspace_id, canonical_root_path, display_name, now],
        )
        .map_err(|error| format!("failed to save workspace metadata: {error}"))?;

    match scope {
        SessionSaveScope::Ui => {
            transaction
                .execute(
                    "INSERT INTO workspace_views
                       (id, workspace_id, view_root_relative_path, layout_json, tree_json, created_at, last_opened_at)
                     VALUES (?1, ?2, ?3, ?4, '[]', ?5, ?5)
                     ON CONFLICT(id) DO UPDATE SET
                       workspace_id = excluded.workspace_id,
                       view_root_relative_path = excluded.view_root_relative_path,
                       layout_json = excluded.layout_json,
                       last_opened_at = excluded.last_opened_at",
                    params![view_id, workspace_id, view_relative_path, ui_json, now],
                )
                .map_err(|error| format!("failed to save workspace UI metadata: {error}"))?;

            transaction
                .execute(
                    "INSERT INTO workspace_windows
                       (id, window_label, workspace_id, workspace_view_id, active_file_id,
                        ui_json, settings_json, saved_at, created_at, last_active_at)
                     VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8, ?8)
                     ON CONFLICT(window_label) DO UPDATE SET
                       active_file_id = CASE
                         WHEN workspace_windows.workspace_id = excluded.workspace_id
                           THEN workspace_windows.active_file_id
                         ELSE NULL
                       END,
                       workspace_id = excluded.workspace_id,
                       workspace_view_id = excluded.workspace_view_id,
                       ui_json = excluded.ui_json,
                       settings_json = excluded.settings_json,
                       saved_at = excluded.saved_at,
                       last_active_at = excluded.last_active_at",
                    params![
                        stable_id("win", window_label),
                        window_label,
                        workspace_id.as_str(),
                        view_id.as_str(),
                        ui_json.as_str(),
                        settings_json.as_str(),
                        saved_at.as_str(),
                        now
                    ],
                )
                .map_err(|error| format!("failed to save window UI metadata: {error}"))?;
        }
        SessionSaveScope::Documents => {
            transaction
                .execute(
                    "INSERT INTO workspace_views
                       (id, workspace_id, view_root_relative_path, layout_json, tree_json, created_at, last_opened_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
                     ON CONFLICT(id) DO UPDATE SET
                       workspace_id = excluded.workspace_id,
                       view_root_relative_path = excluded.view_root_relative_path,
                       tree_json = excluded.tree_json,
                       last_opened_at = excluded.last_opened_at",
                    params![view_id, workspace_id, view_relative_path, ui_json, tree_json, now],
                )
                .map_err(|error| format!("failed to save workspace document metadata: {error}"))?;

            transaction
                .execute(
                    "DELETE FROM window_file_view_state WHERE window_label = ?1 AND workspace_id = ?2",
                    params![window_label, workspace_id],
                )
                .map_err(|error| format!("failed to reset window file view state: {error}"))?;
            transaction
                .execute(
                    "DELETE FROM drafts WHERE window_label = ?1 AND workspace_id = ?2",
                    params![window_label, workspace_id],
                )
                .map_err(|error| format!("failed to reset window drafts: {error}"))?;

            for (index, open_file) in open_files.iter().enumerate() {
                save_window_open_file(
                    &transaction,
                    window_label,
                    &workspace_id,
                    &canonical_root_path,
                    open_file,
                    index,
                    active_file_id.as_deref(),
                    now,
                )?;
            }

            transaction
                .execute(
                    "INSERT INTO workspace_windows
                       (id, window_label, workspace_id, workspace_view_id, active_file_id,
                        ui_json, settings_json, saved_at, created_at, last_active_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
                     ON CONFLICT(window_label) DO UPDATE SET
                       workspace_id = excluded.workspace_id,
                       workspace_view_id = excluded.workspace_view_id,
                       active_file_id = excluded.active_file_id,
                       saved_at = excluded.saved_at,
                       last_active_at = excluded.last_active_at",
                    params![
                        stable_id("win", window_label),
                        window_label,
                        workspace_id.as_str(),
                        view_id.as_str(),
                        active_file_id.as_deref(),
                        ui_json.as_str(),
                        settings_json.as_str(),
                        saved_at.as_str(),
                        now
                    ],
                )
                .map_err(|error| format!("failed to save window document metadata: {error}"))?;
        }
    }

    let open_window_labels = app.webview_windows().keys().cloned().collect::<Vec<_>>();
    prune_closed_workspace_windows(&transaction, &open_window_labels)?;
    prune_old_recent_workspaces(&transaction)?;

    save_metadata_value(&transaction, "schema_version", &SCHEMA_VERSION.to_string())?;
    save_metadata_value(&transaction, "saved_at", &saved_at)?;
    save_metadata_value(&transaction, "active_workspace_id", &workspace_id)?;
    save_metadata_value(&transaction, "active_view_id", &view_id)?;
    match scope {
        SessionSaveScope::Ui => {
            save_metadata_value(&transaction, "settings_json", &settings_json)?;
        }
        SessionSaveScope::Documents => {
            if let Some(active_file_id) = active_file_id {
                save_metadata_value(&transaction, "active_file_id", &active_file_id)?;
            } else {
                delete_metadata_value(&transaction, "active_file_id")?;
            }
        }
    }

    transaction
        .commit()
        .map_err(|error| format!("failed to commit metadata transaction: {error}"))?;

    #[cfg(target_os = "macos")]
    {
        let recent_workspace_snapshot_after =
            recent_workspace_menu_snapshot(&connection).unwrap_or_default();
        drop(connection);
        if recent_workspace_snapshot_before != recent_workspace_snapshot_after {
            crate::platform::macos::native_menu::refresh_menu(app);
        }
    }

    Ok(())
}

pub(crate) fn initialize_metadata_connection(app: &tauri::AppHandle) -> Result<(), String> {
    drop(open_metadata_connection(app)?);
    Ok(())
}

pub(super) struct MetadataConnectionGuard<'a> {
    guard: MutexGuard<'a, Option<Connection>>,
}

impl Deref for MetadataConnectionGuard<'_> {
    type Target = Connection;

    fn deref(&self) -> &Self::Target {
        self.guard
            .as_ref()
            .expect("metadata connection must be initialized")
    }
}

impl DerefMut for MetadataConnectionGuard<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.guard
            .as_mut()
            .expect("metadata connection must be initialized")
    }
}

pub(super) fn open_metadata_connection(
    app: &tauri::AppHandle,
) -> Result<MetadataConnectionGuard<'_>, String> {
    let state = app.state::<AppState>();
    let state = state.inner();
    let mut guard = state
        .metadata_connection
        .lock()
        .map_err(|_| "metadata connection lock is poisoned".to_string())?;

    if guard.is_none() {
        *guard = Some(create_metadata_connection(app)?);
    }

    Ok(MetadataConnectionGuard { guard })
}

fn create_metadata_connection(app: &tauri::AppHandle) -> Result<Connection, String> {
    let path = metadata_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create metadata directory: {error}"))?;
    }

    let mut connection = Connection::open(&path)
        .map_err(|error| format!("failed to open metadata database: {error}"))?;
    configure_metadata_connection(&connection)?;
    initialize_schema(&mut connection)?;
    Ok(connection)
}

fn configure_metadata_connection(connection: &Connection) -> Result<(), String> {
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| format!("failed to enable metadata WAL mode: {error}"))?;
    connection
        .busy_timeout(Duration::from_millis(3_000))
        .map_err(|error| format!("failed to set metadata busy timeout: {error}"))
}

fn initialize_schema(connection: &mut Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS metadata_kv (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workspaces (
              id TEXT PRIMARY KEY,
              canonical_root_path TEXT NOT NULL UNIQUE,
              display_name TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              last_opened_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workspace_views (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL,
              view_root_relative_path TEXT NOT NULL,
              layout_json TEXT,
              tree_json TEXT,
              created_at INTEGER NOT NULL,
              last_opened_at INTEGER NOT NULL,
              UNIQUE(workspace_id, view_root_relative_path),
              FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS workspace_windows (
              id TEXT PRIMARY KEY,
              window_label TEXT NOT NULL UNIQUE,
              workspace_id TEXT NOT NULL,
              workspace_view_id TEXT NOT NULL,
              active_file_id TEXT,
              ui_json TEXT NOT NULL,
              settings_json TEXT NOT NULL,
              saved_at TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              last_active_at INTEGER NOT NULL,
              FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
              FOREIGN KEY(workspace_view_id) REFERENCES workspace_views(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS files (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL,
              relative_path TEXT NOT NULL,
              absolute_path TEXT NOT NULL,
              display_name TEXT NOT NULL,
              path_hash TEXT NOT NULL,
              last_content_hash TEXT,
              last_opened_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              UNIQUE(workspace_id, relative_path),
              FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS file_view_state (
              id TEXT PRIMARY KEY,
              workspace_view_id TEXT NOT NULL,
              file_id TEXT NOT NULL,
              is_open INTEGER NOT NULL DEFAULT 0,
              open_order INTEGER NOT NULL DEFAULT 0,
              is_active INTEGER NOT NULL DEFAULT 0,
              state_json TEXT NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(workspace_view_id, file_id),
              FOREIGN KEY(workspace_view_id) REFERENCES workspace_views(id) ON DELETE CASCADE,
              FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS window_file_view_state (
              id TEXT PRIMARY KEY,
              window_label TEXT NOT NULL,
              workspace_id TEXT NOT NULL,
              file_id TEXT NOT NULL,
              is_open INTEGER NOT NULL DEFAULT 0,
              open_order INTEGER NOT NULL DEFAULT 0,
              is_active INTEGER NOT NULL DEFAULT 0,
              state_json TEXT NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(window_label, workspace_id, file_id),
              FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
              FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS drafts (
              id TEXT PRIMARY KEY,
              window_label TEXT NOT NULL,
              workspace_id TEXT NOT NULL,
              file_id TEXT NOT NULL,
              content TEXT NOT NULL,
              encoding TEXT NOT NULL,
              base_content_hash TEXT,
              content_hash TEXT NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(window_label, workspace_id, file_id),
              FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
              FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS block_layouts (
              id TEXT PRIMARY KEY,
              file_id TEXT NOT NULL,
              block_kind TEXT NOT NULL,
              block_key TEXT NOT NULL,
              occurrence_index INTEGER NOT NULL DEFAULT 0,
              width_value REAL,
              width_unit TEXT NOT NULL DEFAULT 'auto',
              height_value REAL,
              height_unit TEXT NOT NULL DEFAULT 'auto',
              align TEXT NOT NULL DEFAULT 'center',
              layout_json TEXT,
              updated_at INTEGER NOT NULL,
              UNIQUE(file_id, block_kind, block_key, occurrence_index),
              FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS renderer_states (
              id TEXT PRIMARY KEY,
              file_id TEXT NOT NULL,
              renderer_kind TEXT NOT NULL,
              target_key TEXT NOT NULL DEFAULT 'file',
              state_json TEXT NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(file_id, renderer_kind, target_key),
              FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS export_layouts (
              id TEXT PRIMARY KEY,
              workspace_id TEXT,
              file_id TEXT,
              export_kind TEXT NOT NULL,
              layout_json TEXT NOT NULL,
              updated_at INTEGER NOT NULL,
              FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
              FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_files_workspace_opened
              ON files(workspace_id, last_opened_at DESC);
            CREATE INDEX IF NOT EXISTS idx_file_view_state_view_order
              ON file_view_state(workspace_view_id, is_open, open_order);
            CREATE INDEX IF NOT EXISTS idx_workspace_windows_last_active
              ON workspace_windows(last_active_at DESC);
            CREATE INDEX IF NOT EXISTS idx_window_file_view_state_order
              ON window_file_view_state(window_label, workspace_id, is_open, open_order);
            CREATE INDEX IF NOT EXISTS idx_drafts_window_workspace
              ON drafts(window_label, workspace_id, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_block_layouts_file
              ON block_layouts(file_id, block_kind);
            ",
        )
        .map_err(|error| format!("failed to initialize metadata schema: {error}"))?;

    migrate_embedded_file_content(connection)?;
    super::layout_metadata::initialize_schema(connection)
}

struct EmbeddedFileStateRow {
    row_id: String,
    window_label: String,
    workspace_id: String,
    file_id: String,
    state_json: String,
    updated_at: i64,
}

fn migrate_embedded_file_content(connection: &mut Connection) -> Result<(), String> {
    let schema_version = metadata_value(connection, "schema_version")?
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or_default();
    if schema_version >= SCHEMA_VERSION {
        return Ok(());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("failed to start session metadata migration: {error}"))?;

    let window_rows = {
        let mut statement = transaction
            .prepare(
                "SELECT id, window_label, workspace_id, file_id, state_json, updated_at
                 FROM window_file_view_state",
            )
            .map_err(|error| format!("failed to prepare window session migration: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok(EmbeddedFileStateRow {
                    row_id: row.get(0)?,
                    window_label: row.get(1)?,
                    workspace_id: row.get(2)?,
                    file_id: row.get(3)?,
                    state_json: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|error| format!("failed to query window session migration: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("failed to read window session migration: {error}"))?
    };
    for row in window_rows {
        migrate_embedded_file_state(&transaction, "window_file_view_state", row)?;
    }

    let legacy_rows = {
        let mut statement = transaction
            .prepare(
                "SELECT file_view_state.id, workspace_views.workspace_id,
                        file_view_state.file_id, file_view_state.state_json,
                        file_view_state.updated_at
                 FROM file_view_state
                 JOIN workspace_views
                   ON workspace_views.id = file_view_state.workspace_view_id",
            )
            .map_err(|error| format!("failed to prepare legacy session migration: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok(EmbeddedFileStateRow {
                    row_id: row.get(0)?,
                    window_label: LEGACY_DRAFT_WINDOW.to_string(),
                    workspace_id: row.get(1)?,
                    file_id: row.get(2)?,
                    state_json: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|error| format!("failed to query legacy session migration: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("failed to read legacy session migration: {error}"))?
    };
    for row in legacy_rows {
        migrate_embedded_file_state(&transaction, "file_view_state", row)?;
    }

    transaction
        .commit()
        .map_err(|error| format!("failed to commit session metadata migration: {error}"))?;
    connection
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;")
        .map_err(|error| format!("failed to compact migrated session metadata: {error}"))?;
    save_metadata_value(connection, "schema_version", &SCHEMA_VERSION.to_string())
}

fn migrate_embedded_file_state(
    connection: &Connection,
    table: &str,
    row: EmbeddedFileStateRow,
) -> Result<(), String> {
    let Ok(mut state) = serde_json::from_str::<Value>(&row.state_json) else {
        return Ok(());
    };
    let Some(object) = state.as_object_mut() else {
        return Ok(());
    };

    let path = object
        .get("path")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let encoding = object
        .get("encoding")
        .and_then(Value::as_str)
        .unwrap_or("utf-8")
        .to_string();
    let saved_encoding = object
        .get("savedEncoding")
        .and_then(Value::as_str)
        .unwrap_or(&encoding)
        .to_string();
    let eol = object
        .get("eol")
        .and_then(Value::as_str)
        .unwrap_or("LF")
        .to_string();
    let content = object
        .remove("content")
        .and_then(|value| value.as_str().map(str::to_string));
    let saved_content = object
        .remove("savedContent")
        .and_then(|value| value.as_str().map(str::to_string));

    if content.is_none() && saved_content.is_none() {
        return Ok(());
    }

    let saved_content = saved_content.unwrap_or_default();
    let disk_content = serialize_document_content(&saved_content, &eol);
    let base_content_hash = stable_hash(&disk_content);
    connection
        .execute(
            "UPDATE files SET last_content_hash = ?1 WHERE id = ?2",
            params![base_content_hash, row.file_id],
        )
        .map_err(|error| format!("failed to migrate file content hash: {error}"))?;

    if let Some(content) = content {
        let is_dirty =
            path.starts_with('~') || content != saved_content || encoding != saved_encoding;
        if is_dirty {
            upsert_draft(
                connection,
                &row.window_label,
                &row.workspace_id,
                &row.file_id,
                &content,
                &encoding,
                &base_content_hash,
                &eol,
                row.updated_at,
            )?;
        }
    }

    let state_json = serde_json::to_string(&state)
        .map_err(|error| format!("failed to serialize migrated file state: {error}"))?;
    let sql = match table {
        "window_file_view_state" => {
            "UPDATE window_file_view_state SET state_json = ?1 WHERE id = ?2"
        }
        "file_view_state" => "UPDATE file_view_state SET state_json = ?1 WHERE id = ?2",
        _ => return Err("unsupported session metadata migration table".to_string()),
    };
    connection
        .execute(sql, params![state_json, row.row_id])
        .map_err(|error| format!("failed to remove embedded file content: {error}"))?;
    Ok(())
}

fn delete_document_draft_from_metadata(
    app: &tauri::AppHandle,
    window_label: &str,
    file_path: &str,
) -> Result<(), String> {
    let connection = open_metadata_connection(app)?;
    connection
        .execute(
            "DELETE FROM drafts
             WHERE window_label IN (?1, ?2)
               AND file_id IN (SELECT id FROM files WHERE absolute_path = ?3)",
            params![window_label, LEGACY_DRAFT_WINDOW, file_path],
        )
        .map_err(|error| format!("failed to delete saved document draft: {error}"))?;
    Ok(())
}

pub(super) fn find_file_for_path(
    connection: &Connection,
    file_path: &str,
) -> Result<Option<(String, String)>, String> {
    connection
        .query_row(
            "SELECT id, workspace_id FROM files WHERE absolute_path = ?1 ORDER BY last_opened_at DESC LIMIT 1",
            params![file_path],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|error| format!("failed to find file metadata: {error}"))
}

pub(super) fn workspace_context_for_file(
    connection: &Connection,
    window_label: &str,
    file_path: &str,
) -> Result<(String, String), String> {
    if let Some((workspace_id, canonical_root_path)) =
        active_workspace_context(connection, Some(window_label))?
    {
        if path_is_inside(file_path, &canonical_root_path) {
            return Ok((workspace_id, canonical_root_path));
        }
    }

    if let Some((_, workspace_id)) = find_file_for_path(connection, file_path)? {
        let canonical_root_path = connection
            .query_row(
                "SELECT canonical_root_path FROM workspaces WHERE id = ?1",
                params![workspace_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("failed to load file workspace metadata: {error}"))?
            .unwrap_or_else(|| parent_path(file_path).unwrap_or_default());
        return Ok((workspace_id, canonical_root_path));
    }

    let canonical_root_path = parent_path(file_path).unwrap_or_default();
    let workspace_id = if canonical_root_path.is_empty() {
        DEFAULT_WORKSPACE_ID.to_string()
    } else {
        stable_id("ws", &canonical_root_path)
    };
    Ok((workspace_id, canonical_root_path))
}

fn active_workspace_context(
    connection: &Connection,
    window_label: Option<&str>,
) -> Result<Option<(String, String)>, String> {
    if let Some(window_label) = window_label {
        let context = connection
            .query_row(
                "SELECT workspace_windows.workspace_id, workspaces.canonical_root_path
                 FROM workspace_windows
                 JOIN workspaces ON workspaces.id = workspace_windows.workspace_id
                 WHERE workspace_windows.window_label = ?1",
                params![window_label],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|error| format!("failed to load active window workspace metadata: {error}"))?;

        if context.is_some() {
            return Ok(context);
        }
    }

    let Some(workspace_id) = metadata_value(connection, "active_workspace_id")? else {
        return Ok(None);
    };
    let canonical_root_path = connection
        .query_row(
            "SELECT canonical_root_path FROM workspaces WHERE id = ?1",
            params![workspace_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to load active workspace metadata: {error}"))?;
    Ok(canonical_root_path.map(|path| (workspace_id, path)))
}

pub(super) fn ensure_workspace(
    connection: &Connection,
    workspace_id: &str,
    canonical_root_path: &str,
) -> Result<(), String> {
    let now = current_timestamp_millis();
    connection
        .execute(
            "INSERT INTO workspaces (id, canonical_root_path, display_name, created_at, last_opened_at)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(id) DO UPDATE SET
               canonical_root_path = excluded.canonical_root_path,
               display_name = excluded.display_name,
               last_opened_at = excluded.last_opened_at",
            params![
                workspace_id,
                canonical_root_path,
                workspace_display_name(canonical_root_path),
                now
            ],
        )
        .map_err(|error| format!("failed to ensure workspace metadata: {error}"))?;
    Ok(())
}

fn prune_closed_workspace_windows(
    connection: &Connection,
    open_window_labels: &[String],
) -> Result<(), String> {
    if open_window_labels.is_empty() {
        return Ok(());
    }

    let placeholders = (0..open_window_labels.len())
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(", ");
    connection
        .execute(
            &format!("DELETE FROM workspace_windows WHERE window_label NOT IN ({placeholders})"),
            params_from_iter(open_window_labels.iter()),
        )
        .map_err(|error| format!("failed to prune closed workspace windows: {error}"))?;
    Ok(())
}

fn prune_old_recent_workspaces(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM workspaces
             WHERE canonical_root_path != ''
               AND id NOT IN (
                 SELECT id FROM (
                   SELECT id FROM workspaces
                   WHERE canonical_root_path != ''
                   ORDER BY last_opened_at DESC
                   LIMIT 5
                 )
               )
               AND id NOT IN (SELECT workspace_id FROM workspace_windows)",
            [],
        )
        .map_err(|error| format!("failed to prune old recent workspaces: {error}"))?;
    Ok(())
}

fn save_window_open_file(
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
    canonical_root_path: &str,
    open_file: &Value,
    index: usize,
    active_file_id: Option<&str>,
    now: i64,
) -> Result<(), String> {
    let Some(path) = open_file.get("path").and_then(Value::as_str) else {
        return Ok(());
    };
    let file_id_from_session = open_file.get("id").and_then(Value::as_str);
    let name = open_file
        .get("name")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| file_name_from_path(path));
    let content = open_file
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let saved_content = open_file
        .get("savedContent")
        .and_then(Value::as_str)
        .unwrap_or(content);
    let encoding = open_file
        .get("encoding")
        .and_then(Value::as_str)
        .unwrap_or("utf-8");
    let saved_encoding = open_file
        .get("savedEncoding")
        .and_then(Value::as_str)
        .unwrap_or(encoding);
    let eol = open_file.get("eol").and_then(Value::as_str).unwrap_or("LF");
    let disk_content = serialize_document_content(saved_content, eol);
    let content_hash = stable_hash(&disk_content);
    let file_id = upsert_file(
        connection,
        workspace_id,
        canonical_root_path,
        path,
        &name,
        Some(&content_hash),
        now,
    )?;
    let mut view_state = open_file.clone();
    if let Some(object) = view_state.as_object_mut() {
        object.remove("content");
        object.remove("savedContent");
    }
    let state_json = serde_json::to_string(&view_state)
        .map_err(|error| format!("failed to serialize file session metadata: {error}"))?;
    let state_id = stable_id("wfvs", &format!("{window_label}:{workspace_id}:{file_id}"));
    let is_active = file_id_from_session
        .zip(active_file_id)
        .map(|(file_id, active_file_id)| file_id == active_file_id)
        .unwrap_or(false);

    connection
        .execute(
            "INSERT INTO window_file_view_state
               (id, window_label, workspace_id, file_id, is_open, open_order, is_active, state_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8)
             ON CONFLICT(window_label, workspace_id, file_id) DO UPDATE SET
               is_open = excluded.is_open,
               open_order = excluded.open_order,
               is_active = excluded.is_active,
               state_json = excluded.state_json,
               updated_at = excluded.updated_at",
            params![
                state_id,
                window_label,
                workspace_id,
                file_id,
                index as i64,
                i64::from(is_active),
                state_json,
                now
            ],
        )
        .map_err(|error| format!("failed to save window file view state: {error}"))?;

    connection
        .execute(
            "DELETE FROM drafts WHERE window_label = ?1 AND workspace_id = ?2 AND file_id = ?3",
            params![LEGACY_DRAFT_WINDOW, workspace_id, file_id],
        )
        .map_err(|error| format!("failed to remove migrated document draft: {error}"))?;

    if path.starts_with('~') || content != saved_content || encoding != saved_encoding {
        upsert_draft(
            connection,
            window_label,
            workspace_id,
            &file_id,
            content,
            encoding,
            &content_hash,
            eol,
            now,
        )?;
    }

    Ok(())
}

fn upsert_draft(
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
    file_id: &str,
    content: &str,
    encoding: &str,
    base_content_hash: &str,
    eol: &str,
    updated_at: i64,
) -> Result<(), String> {
    let content_hash = stable_hash(&serialize_document_content(content, eol));
    let draft_id = stable_id("draft", &format!("{window_label}:{workspace_id}:{file_id}"));
    connection
        .execute(
            "INSERT INTO drafts
               (id, window_label, workspace_id, file_id, content, encoding,
                base_content_hash, content_hash, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(window_label, workspace_id, file_id) DO UPDATE SET
               content = excluded.content,
               encoding = excluded.encoding,
               base_content_hash = excluded.base_content_hash,
               content_hash = excluded.content_hash,
               updated_at = excluded.updated_at",
            params![
                draft_id,
                window_label,
                workspace_id,
                file_id,
                content,
                encoding,
                base_content_hash,
                content_hash,
                updated_at
            ],
        )
        .map_err(|error| format!("failed to save document draft: {error}"))?;
    Ok(())
}

pub(super) fn upsert_file(
    connection: &Connection,
    workspace_id: &str,
    canonical_root_path: &str,
    absolute_path: &str,
    display_name: &str,
    content_hash: Option<&str>,
    opened_at: i64,
) -> Result<String, String> {
    let relative_path = relative_path(canonical_root_path, absolute_path);
    let file_id = stable_id("file", &format!("{workspace_id}:{relative_path}"));
    let path_hash = stable_hash(&relative_path);

    connection
        .execute(
            "INSERT INTO files
               (id, workspace_id, relative_path, absolute_path, display_name, path_hash,
                last_content_hash, last_opened_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(workspace_id, relative_path) DO UPDATE SET
               absolute_path = excluded.absolute_path,
               display_name = excluded.display_name,
               path_hash = excluded.path_hash,
               last_content_hash = COALESCE(excluded.last_content_hash, files.last_content_hash),
               last_opened_at = MAX(files.last_opened_at, excluded.last_opened_at)",
            params![
                file_id,
                workspace_id,
                relative_path,
                absolute_path,
                display_name,
                path_hash,
                content_hash,
                opened_at
            ],
        )
        .map_err(|error| format!("failed to save file metadata: {error}"))?;

    Ok(file_id)
}

fn load_open_files(
    app: &tauri::AppHandle,
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
    view_id: &str,
) -> Result<Value, String> {
    let files = load_window_open_files(app, connection, window_label, workspace_id)?;
    if !files.is_empty() {
        return Ok(Value::Array(files));
    }

    Ok(Value::Array(load_legacy_open_files(
        app,
        connection,
        window_label,
        workspace_id,
        view_id,
    )?))
}

fn load_window_open_files(
    app: &tauri::AppHandle,
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
) -> Result<Vec<Value>, String> {
    let mut statement = connection
        .prepare(
            "SELECT window_file_view_state.state_json, files.id, files.absolute_path,
                    files.last_content_hash
             FROM window_file_view_state
             JOIN files ON files.id = window_file_view_state.file_id
             WHERE window_file_view_state.window_label = ?1
               AND window_file_view_state.workspace_id = ?2
               AND window_file_view_state.is_open = 1
             ORDER BY window_file_view_state.open_order ASC",
        )
        .map_err(|error| format!("failed to prepare window open files query: {error}"))?;

    let rows = statement
        .query_map(params![window_label, workspace_id], |row| {
            Ok(FileStateRow {
                state_json: row.get(0)?,
                file_id: row.get(1)?,
                absolute_path: row.get(2)?,
                expected_content_hash: row.get(3)?,
            })
        })
        .map_err(|error| format!("failed to query window open files: {error}"))?;

    let rows = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to read window open file row: {error}"))?;
    drop(statement);
    restore_file_state_rows(app, connection, window_label, workspace_id, rows)
}

fn load_legacy_open_files(
    app: &tauri::AppHandle,
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
    view_id: &str,
) -> Result<Vec<Value>, String> {
    let mut statement = connection
        .prepare(
            "SELECT file_view_state.state_json, files.id, files.absolute_path,
                    files.last_content_hash
             FROM file_view_state
             JOIN files ON files.id = file_view_state.file_id
             WHERE file_view_state.workspace_view_id = ?1
               AND file_view_state.is_open = 1
             ORDER BY file_view_state.open_order ASC",
        )
        .map_err(|error| format!("failed to prepare open files query: {error}"))?;

    let rows = statement
        .query_map(params![view_id], |row| {
            Ok(FileStateRow {
                state_json: row.get(0)?,
                file_id: row.get(1)?,
                absolute_path: row.get(2)?,
                expected_content_hash: row.get(3)?,
            })
        })
        .map_err(|error| format!("failed to query open files: {error}"))?;

    let rows = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to read legacy open file row: {error}"))?;
    drop(statement);
    restore_file_state_rows(app, connection, window_label, workspace_id, rows)
}

struct FileStateRow {
    state_json: String,
    file_id: String,
    absolute_path: String,
    expected_content_hash: Option<String>,
}

struct DraftState {
    id: String,
    content: String,
    encoding: String,
    base_content_hash: Option<String>,
    content_hash: String,
}

fn restore_file_state_rows(
    app: &tauri::AppHandle,
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
    rows: Vec<FileStateRow>,
) -> Result<Vec<Value>, String> {
    let mut files = Vec::new();
    for row in rows {
        let Ok(mut file) = serde_json::from_str::<Value>(&row.state_json) else {
            continue;
        };
        let draft = load_draft(connection, window_label, workspace_id, &row.file_id)?;
        if restore_file_content(app, connection, &row, draft, &mut file)? {
            files.push(file);
        }
    }

    Ok(files)
}

fn load_draft(
    connection: &Connection,
    window_label: &str,
    workspace_id: &str,
    file_id: &str,
) -> Result<Option<DraftState>, String> {
    connection
        .query_row(
            "SELECT id, content, encoding, base_content_hash, content_hash
             FROM drafts
             WHERE workspace_id = ?1 AND file_id = ?2
               AND window_label IN (?3, ?4)
             ORDER BY CASE WHEN window_label = ?3 THEN 0 ELSE 1 END, updated_at DESC
             LIMIT 1",
            params![workspace_id, file_id, window_label, LEGACY_DRAFT_WINDOW],
            |row| {
                Ok(DraftState {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    encoding: row.get(2)?,
                    base_content_hash: row.get(3)?,
                    content_hash: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("failed to load document draft: {error}"))
}

fn restore_file_content(
    app: &tauri::AppHandle,
    connection: &Connection,
    row: &FileStateRow,
    mut draft: Option<DraftState>,
    file: &mut Value,
) -> Result<bool, String> {
    let disk_file = super::file::read_file_payload(app, row.absolute_path.clone());
    let (saved_content, saved_encoding, display_path) = match disk_file {
        Ok(payload) => {
            let actual_hash = stable_hash(&payload.content);
            if row.expected_content_hash.as_deref() != Some(actual_hash.as_str()) {
                eprintln!(
                    "[saekim:session] content hash changed for {} (expected {:?}, actual {})",
                    row.absolute_path, row.expected_content_hash, actual_hash
                );
            }

            let disk_encoding = encoding_value(payload.encoding);
            if let Some(candidate) = draft.as_ref() {
                if candidate.content_hash == actual_hash && candidate.encoding == disk_encoding {
                    connection
                        .execute("DELETE FROM drafts WHERE id = ?1", params![candidate.id])
                        .map_err(|error| {
                            format!("failed to delete completed document draft: {error}")
                        })?;
                    draft = None;
                } else if candidate.base_content_hash.as_deref() != Some(actual_hash.as_str()) {
                    eprintln!(
                        "[saekim:session] preserving draft over externally changed file {}",
                        row.absolute_path
                    );
                }
            }
            (payload.content, disk_encoding, payload.display_path)
        }
        Err(error) => {
            if draft.is_none() {
                eprintln!(
                    "[saekim:session] skipping unavailable file {}: {}",
                    row.absolute_path, error
                );
                return Ok(false);
            }
            let saved_encoding = file
                .get("savedEncoding")
                .and_then(Value::as_str)
                .unwrap_or("utf-8")
                .to_string();
            (String::new(), saved_encoding, None)
        }
    };

    let Some(object) = file.as_object_mut() else {
        return Ok(false);
    };
    object.insert("path".to_string(), Value::String(row.absolute_path.clone()));
    object.insert(
        "savedContent".to_string(),
        Value::String(saved_content.clone()),
    );
    object.insert(
        "savedEncoding".to_string(),
        Value::String(saved_encoding.clone()),
    );
    if let Some(display_path) = display_path {
        object.insert("displayPath".to_string(), Value::String(display_path));
    }

    if let Some(draft) = draft {
        object.insert("content".to_string(), Value::String(draft.content));
        object.insert("encoding".to_string(), Value::String(draft.encoding));
    } else {
        let (eol, mixed) = detect_line_endings(&saved_content);
        object.insert("content".to_string(), Value::String(saved_content));
        object.insert("encoding".to_string(), Value::String(saved_encoding));
        object.insert("eol".to_string(), Value::String(eol.to_string()));
        object.insert("hasMixedEol".to_string(), Value::Bool(mixed));
    }
    Ok(true)
}

fn load_recent_workspaces(connection: &Connection) -> Result<Value, String> {
    let workspaces = load_recent_workspace_rows(connection)?
        .into_iter()
        .map(|workspace| {
            json!({
                "id": workspace.id,
                "path": workspace.path,
                "name": workspace.name,
                "openedAt": workspace.opened_at,
                "windowId": workspace.window_id,
            })
        })
        .collect();

    Ok(Value::Array(workspaces))
}

#[derive(Clone, Debug)]
pub(crate) struct RecentWorkspaceMenuEntry {
    pub id: String,
    pub path: String,
    pub name: String,
}

struct RecentWorkspaceRow {
    id: String,
    path: String,
    name: String,
    opened_at: i64,
    window_id: Option<String>,
}

pub(crate) fn recent_workspace_menu_entries(
    app: &tauri::AppHandle,
) -> Vec<RecentWorkspaceMenuEntry> {
    match open_metadata_connection(app)
        .and_then(|connection| load_recent_workspace_rows(&connection))
    {
        Ok(workspaces) => workspaces
            .into_iter()
            .map(|workspace| RecentWorkspaceMenuEntry {
                id: workspace.id,
                path: workspace.path,
                name: workspace.name,
            })
            .collect(),
        Err(error) => {
            eprintln!("[saekim:native-menu] failed to load recent workspaces: {error}");
            Vec::new()
        }
    }
}

fn recent_workspace_menu_snapshot(
    connection: &Connection,
) -> Result<Vec<(String, String, String)>, String> {
    Ok(load_recent_workspace_rows(connection)?
        .into_iter()
        .map(|workspace| (workspace.id, workspace.path, workspace.name))
        .collect())
}

pub(crate) fn recent_workspace_path(app: &tauri::AppHandle, workspace_id: &str) -> Option<String> {
    open_metadata_connection(app)
        .and_then(|connection| {
            connection
                .query_row(
                    "SELECT canonical_root_path FROM workspaces
                     WHERE id = ?1 AND canonical_root_path != ''
                     LIMIT 1",
                    params![workspace_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()
                .map_err(|error| format!("failed to load recent workspace path: {error}"))
        })
        .unwrap_or_else(|error| {
            eprintln!("[saekim:native-menu] failed to resolve recent workspace: {error}");
            None
        })
}

fn load_recent_workspace_rows(connection: &Connection) -> Result<Vec<RecentWorkspaceRow>, String> {
    let mut statement = connection
        .prepare(
            "SELECT workspaces.id, workspaces.canonical_root_path, workspaces.display_name,
                    workspaces.last_opened_at, workspace_windows.window_label
             FROM workspaces
             LEFT JOIN workspace_windows ON workspace_windows.workspace_id = workspaces.id
             WHERE workspaces.canonical_root_path != ''
             GROUP BY workspaces.id
             ORDER BY workspaces.last_opened_at DESC
             LIMIT 5",
        )
        .map_err(|error| format!("failed to prepare recent workspaces query: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(RecentWorkspaceRow {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                opened_at: row.get(3)?,
                window_id: row.get(4)?,
            })
        })
        .map_err(|error| format!("failed to query recent workspaces: {error}"))?;

    let mut workspaces = Vec::new();
    for row in rows {
        workspaces
            .push(row.map_err(|error| format!("failed to read recent workspace row: {error}"))?);
    }

    Ok(workspaces)
}

fn metadata_value(connection: &Connection, key: &str) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT value FROM metadata_kv WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to load metadata value {key}: {error}"))
}

pub(super) fn save_metadata_value(
    connection: &Connection,
    key: &str,
    value: &str,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO metadata_kv (key, value, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at",
            params![key, value, current_timestamp_millis()],
        )
        .map_err(|error| format!("failed to save metadata value {key}: {error}"))?;
    Ok(())
}

fn delete_metadata_value(connection: &Connection, key: &str) -> Result<(), String> {
    connection
        .execute("DELETE FROM metadata_kv WHERE key = ?1", params![key])
        .map_err(|error| format!("failed to delete metadata value {key}: {error}"))?;
    Ok(())
}

fn load_legacy_session() -> Result<Option<Value>, String> {
    let path = legacy_session_path();
    if !path.exists() {
        return Ok(None);
    }

    fs::read_to_string(&path)
        .map_err(|error| format!("failed to read legacy session: {error}"))
        .and_then(|content| {
            serde_json::from_str(&content)
                .map(Some)
                .map_err(|error| format!("failed to parse legacy session: {error}"))
        })
}

fn parse_json_value(raw: Option<&str>, fallback: Value) -> Value {
    raw.and_then(|value| serde_json::from_str(value).ok())
        .unwrap_or(fallback)
}

fn canonical_root_path(root_path: Option<&str>, open_files: &[Value]) -> Option<String> {
    if let Some(root_path) = root_path.filter(|path| !path.is_empty()) {
        return Some(root_path.to_string());
    }

    open_files.iter().find_map(|file| {
        file.get("path")
            .and_then(Value::as_str)
            .and_then(parent_path)
    })
}

fn resolve_view_root(canonical_root_path: &str, view_relative_path: &str) -> String {
    if canonical_root_path.is_empty() {
        return String::new();
    }
    if view_relative_path == "." || view_relative_path.is_empty() {
        canonical_root_path.to_string()
    } else {
        Path::new(canonical_root_path)
            .join(view_relative_path)
            .to_string_lossy()
            .to_string()
    }
}

fn path_is_inside(path: &str, root_path: &str) -> bool {
    if root_path.is_empty() {
        return false;
    }
    Path::new(path).starts_with(root_path)
}

fn relative_path(root_path: &str, path: &str) -> String {
    if root_path.is_empty() {
        return path.to_string();
    }

    Path::new(path)
        .strip_prefix(root_path)
        .ok()
        .and_then(|path| {
            let value = path.to_string_lossy().replace('\\', "/");
            (!value.is_empty()).then_some(value)
        })
        .unwrap_or_else(|| {
            let normalized_root = root_path.trim_end_matches('/').trim_end_matches('\\');
            let normalized_path = path.replace('\\', "/");
            let prefix = format!("{}/", normalized_root.replace('\\', "/"));
            normalized_path
                .strip_prefix(&prefix)
                .unwrap_or(path)
                .to_string()
        })
}

fn parent_path(path: &str) -> Option<String> {
    let path = Path::new(path);
    path.parent()
        .map(|parent| parent.to_string_lossy().to_string())
}

fn workspace_display_name(path: &str) -> String {
    if path.is_empty() {
        return "Saekim".to_string();
    }

    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or(path)
        .to_string()
}

pub(super) fn file_name_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("untitled.md")
        .to_string()
}

fn metadata_path(_app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        return _app
            .path()
            .app_config_dir()
            .map(|path| path.join("metadata.sqlite3"))
            .map_err(|error| format!("failed to resolve metadata directory: {error}"));
    }

    #[cfg(not(target_os = "android"))]
    {
        Ok(dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Saekim")
            .join("metadata.sqlite3"))
    }
}

fn legacy_session_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Saekim")
        .join("session.json")
}

pub(super) fn stable_id(prefix: &str, value: &str) -> String {
    format!("{prefix}_{}", stable_hash(value))
}

fn stable_hash(value: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn encoding_value(encoding: crate::core::text_file::TextEncoding) -> String {
    match encoding {
        crate::core::text_file::TextEncoding::Utf8 => "utf-8",
        crate::core::text_file::TextEncoding::Utf8Bom => "utf-8-bom",
        crate::core::text_file::TextEncoding::Utf16Le => "utf-16le",
        crate::core::text_file::TextEncoding::Utf16Be => "utf-16be",
    }
    .to_string()
}

fn serialize_document_content(content: &str, eol: &str) -> String {
    let normalized = content.replace("\r\n", "\n");
    if eol == "CRLF" {
        normalized.replace('\n', "\r\n")
    } else {
        normalized
    }
}

fn detect_line_endings(content: &str) -> (&'static str, bool) {
    let bytes = content.as_bytes();
    let mut crlf_count = 0;
    let mut lf_count = 0;
    for (index, byte) in bytes.iter().enumerate() {
        if *byte != b'\n' {
            continue;
        }
        if index > 0 && bytes[index - 1] == b'\r' {
            crlf_count += 1;
        } else {
            lf_count += 1;
        }
    }
    let eol = if crlf_count >= lf_count && crlf_count > 0 {
        "CRLF"
    } else {
        "LF"
    };
    (eol, crlf_count > 0 && lf_count > 0)
}

pub(super) fn normalized_unit(value: &str) -> String {
    match value {
        "px" | "%" | "auto" => value.to_string(),
        _ => "auto".to_string(),
    }
}

pub(super) fn normalized_align(value: &str) -> String {
    match value {
        "left" | "center" | "right" => value.to_string(),
        _ => "center".to_string(),
    }
}

pub(super) fn current_timestamp_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn default_ui() -> Value {
    json!({
        "sidebarMode": "expanded",
        "sidebarViewMode": "files",
        "viewMode": "split",
        "sidebarWidth": 248,
        "splitRatio": 0.5,
        "syncScroll": true
    })
}

fn default_settings() -> Value {
    json!({
        "theme": "default",
        "fontSize": 13.5,
        "editorFontFamily": "Pretendard Variable",
        "htmlPreviewMode": "browser"
    })
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

#[cfg(test)]
mod tests {
    use super::{
        configure_metadata_connection, ensure_workspace, initialize_schema,
        migrate_embedded_file_content, relative_path, save_metadata_value, save_window_open_file,
        stable_hash, upsert_file,
    };
    use rusqlite::{params, Connection, OptionalExtension};
    use serde_json::json;
    use std::{
        env, fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn relative_path_uses_workspace_root() {
        assert_eq!(
            relative_path("/Users/yoon/project", "/Users/yoon/project/docs/guide.md"),
            "docs/guide.md"
        );
    }

    #[test]
    fn stable_hash_is_repeatable() {
        assert_eq!(stable_hash("docs/guide.md"), stable_hash("docs/guide.md"));
        assert_ne!(stable_hash("docs/guide.md"), stable_hash("README.md"));
    }

    #[test]
    fn metadata_connection_uses_wal_and_busy_timeout() {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = env::temp_dir().join(format!("saekim-metadata-{timestamp}.sqlite3"));
        let mut connection = Connection::open(&path).unwrap();

        configure_metadata_connection(&connection).unwrap();
        initialize_schema(&mut connection).unwrap();

        let journal_mode: String = connection
            .pragma_query_value(None, "journal_mode", |row| row.get(0))
            .unwrap();
        let busy_timeout: i64 = connection
            .pragma_query_value(None, "busy_timeout", |row| row.get(0))
            .unwrap();
        assert_eq!(journal_mode, "wal");
        assert_eq!(busy_timeout, 3_000);

        drop(connection);
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("sqlite3-shm"));
        let _ = fs::remove_file(path.with_extension("sqlite3-wal"));
    }

    #[test]
    fn document_session_keeps_body_only_for_dirty_drafts() {
        let mut connection = Connection::open_in_memory().unwrap();
        initialize_schema(&mut connection).unwrap();
        ensure_workspace(&connection, "ws_test", "/project").unwrap();

        let clean_file = json!({
            "id": "/project/clean.md",
            "path": "/project/clean.md",
            "name": "clean.md",
            "content": "saved body",
            "savedContent": "saved body",
            "encoding": "utf-8",
            "savedEncoding": "utf-8",
            "eol": "LF"
        });
        save_window_open_file(
            &connection,
            "main",
            "ws_test",
            "/project",
            &clean_file,
            0,
            Some("/project/clean.md"),
            1,
        )
        .unwrap();

        let stored_state: String = connection
            .query_row(
                "SELECT state_json FROM window_file_view_state WHERE window_label = 'main'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!stored_state.contains("saved body"));
        let clean_draft_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM drafts", [], |row| row.get(0))
            .unwrap();
        assert_eq!(clean_draft_count, 0);

        let dirty_file = json!({
            "id": "/project/dirty.md",
            "path": "/project/dirty.md",
            "name": "dirty.md",
            "content": "unsaved body",
            "savedContent": "saved body",
            "encoding": "utf-8",
            "savedEncoding": "utf-8",
            "eol": "LF"
        });
        save_window_open_file(
            &connection,
            "main",
            "ws_test",
            "/project",
            &dirty_file,
            1,
            None,
            2,
        )
        .unwrap();

        let dirty_state: String = connection
            .query_row(
                "SELECT state_json FROM window_file_view_state WHERE open_order = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let draft_content: String = connection
            .query_row(
                "SELECT content FROM drafts WHERE window_label = 'main'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!dirty_state.contains("saved body"));
        assert!(!dirty_state.contains("unsaved body"));
        assert_eq!(draft_content, "unsaved body");
    }

    #[test]
    fn schema_v3_migrates_embedded_body_to_a_dirty_draft() {
        let mut connection = Connection::open_in_memory().unwrap();
        initialize_schema(&mut connection).unwrap();
        ensure_workspace(&connection, "ws_test", "/project").unwrap();
        let file_id = upsert_file(
            &connection,
            "ws_test",
            "/project",
            "/project/.env",
            ".env",
            None,
            1,
        )
        .unwrap();
        let legacy_state = json!({
            "id": "/project/.env",
            "path": "/project/.env",
            "name": ".env",
            "content": "TOKEN=unsaved",
            "savedContent": "TOKEN=saved",
            "encoding": "utf-8",
            "savedEncoding": "utf-8",
            "eol": "LF"
        })
        .to_string();
        connection
            .execute(
                "INSERT INTO window_file_view_state
                   (id, window_label, workspace_id, file_id, is_open, open_order,
                    is_active, state_json, updated_at)
                 VALUES ('legacy-row', 'main', 'ws_test', ?1, 1, 0, 1, ?2, 2)",
                params![file_id, legacy_state],
            )
            .unwrap();
        save_metadata_value(&connection, "schema_version", "2").unwrap();

        migrate_embedded_file_content(&mut connection).unwrap();

        let migrated_state: String = connection
            .query_row(
                "SELECT state_json FROM window_file_view_state WHERE id = 'legacy-row'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let draft: Option<String> = connection
            .query_row(
                "SELECT content FROM drafts WHERE file_id = ?1",
                params![file_id],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        let last_content_hash: String = connection
            .query_row(
                "SELECT last_content_hash FROM files WHERE id = ?1",
                params![file_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!migrated_state.contains("TOKEN=saved"));
        assert!(!migrated_state.contains("TOKEN=unsaved"));
        assert_eq!(draft.as_deref(), Some("TOKEN=unsaved"));
        assert_eq!(last_content_hash, stable_hash("TOKEN=saved"));
    }
}
