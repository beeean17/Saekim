use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::file::CommandResult;

const SCHEMA_VERSION: i64 = 1;
const DEFAULT_WORKSPACE_ID: &str = "ws_default";
const DEFAULT_VIEW_ID: &str = "view_default";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockLayoutPayload {
    file_path: String,
    block_kind: String,
    block_key: String,
    occurrence_index: i64,
    width_value: Option<f64>,
    width_unit: String,
    height_value: Option<f64>,
    height_unit: String,
    align: String,
    layout_json: Option<Value>,
}

#[tauri::command]
pub fn load_session() -> CommandResult<Option<Value>> {
    match load_session_from_metadata().or_else(|_| load_legacy_session()) {
        Ok(session) => ok(session),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn save_session(session: Value) -> CommandResult<Option<()>> {
    match save_session_to_metadata(&session) {
        Ok(()) => ok(Some(())),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn load_block_layouts(file_path: String) -> CommandResult<Vec<BlockLayoutPayload>> {
    match load_block_layouts_from_metadata(&file_path) {
        Ok(layouts) => ok(layouts),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn save_block_layout(layout: BlockLayoutPayload) -> CommandResult<Option<()>> {
    match save_block_layout_to_metadata(&layout) {
        Ok(()) => ok(Some(())),
        Err(error) => fail(error),
    }
}

fn load_session_from_metadata() -> Result<Option<Value>, String> {
    let connection = open_metadata_connection()?;
    let saved_at = metadata_value(&connection, "saved_at")?;
    if saved_at.is_none() {
        return Ok(None);
    }

    let workspace_id =
        metadata_value(&connection, "active_workspace_id")?.unwrap_or_else(|| DEFAULT_WORKSPACE_ID.to_string());
    let view_id =
        metadata_value(&connection, "active_view_id")?.unwrap_or_else(|| DEFAULT_VIEW_ID.to_string());
    let active_file_id = metadata_value(&connection, "active_file_id")?;
    let settings = parse_json_value(
        metadata_value(&connection, "settings_json")?.as_deref(),
        default_settings(),
    );

    let workspace_row = connection
        .query_row(
            "SELECT canonical_root_path FROM workspaces WHERE id = ?1",
            params![workspace_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("failed to load workspace metadata: {error}"))?;

    let view_row = connection
        .query_row(
            "SELECT view_root_relative_path, layout_json, tree_json FROM workspace_views WHERE id = ?1",
            params![view_id],
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
            parse_json_value(layout_json.as_deref(), default_ui()),
            parse_json_value(tree_json.as_deref(), json!([])),
        ),
        _ => (None, default_ui(), json!([])),
    };

    let open_files = load_open_files(&connection, &view_id)?;
    let recent_files = load_recent_files(&connection, &workspace_id)?;

    Ok(Some(json!({
        "version": 1,
        "savedAt": saved_at.unwrap_or_else(|| current_timestamp_millis().to_string()),
        "workspace": {
            "rootPath": root_path,
            "tree": tree,
            "openFiles": open_files,
            "recentFiles": recent_files,
            "activeFileId": active_file_id,
        },
        "ui": ui,
        "settings": settings,
    })))
}

fn save_session_to_metadata(session: &Value) -> Result<(), String> {
    let mut connection = open_metadata_connection()?;
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
    let recent_files = workspace
        .get("recentFiles")
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
    let ui_json =
        serde_json::to_string(&ui).map_err(|error| format!("failed to serialize UI metadata: {error}"))?;
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

    transaction
        .execute(
            "INSERT INTO workspace_views
               (id, workspace_id, view_root_relative_path, layout_json, tree_json, created_at, last_opened_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
             ON CONFLICT(id) DO UPDATE SET
               workspace_id = excluded.workspace_id,
               view_root_relative_path = excluded.view_root_relative_path,
               layout_json = excluded.layout_json,
               tree_json = excluded.tree_json,
               last_opened_at = excluded.last_opened_at",
            params![view_id, workspace_id, view_relative_path, ui_json, tree_json, now],
        )
        .map_err(|error| format!("failed to save workspace view metadata: {error}"))?;

    transaction
        .execute(
            "DELETE FROM file_view_state WHERE workspace_view_id = ?1",
            params![view_id],
        )
        .map_err(|error| format!("failed to reset file view state: {error}"))?;

    for recent_file in recent_files {
        save_recent_file(&transaction, &workspace_id, &canonical_root_path, &recent_file, now)?;
    }

    for (index, open_file) in open_files.iter().enumerate() {
        save_open_file(
            &transaction,
            &workspace_id,
            &view_id,
            &canonical_root_path,
            open_file,
            index,
            active_file_id.as_deref(),
            now,
        )?;
    }

    save_metadata_value(&transaction, "schema_version", &SCHEMA_VERSION.to_string())?;
    save_metadata_value(&transaction, "saved_at", &saved_at)?;
    save_metadata_value(&transaction, "active_workspace_id", &workspace_id)?;
    save_metadata_value(&transaction, "active_view_id", &view_id)?;
    save_metadata_value(&transaction, "settings_json", &settings_json)?;
    if let Some(active_file_id) = active_file_id {
        save_metadata_value(&transaction, "active_file_id", &active_file_id)?;
    } else {
        delete_metadata_value(&transaction, "active_file_id")?;
    }

    transaction
        .commit()
        .map_err(|error| format!("failed to commit metadata transaction: {error}"))
}

fn load_block_layouts_from_metadata(file_path: &str) -> Result<Vec<BlockLayoutPayload>, String> {
    let connection = open_metadata_connection()?;
    let Some((file_id, _workspace_id)) = find_file_for_path(&connection, file_path)? else {
        return Ok(Vec::new());
    };

    let mut statement = connection
        .prepare(
            "SELECT block_kind, block_key, occurrence_index, width_value, width_unit,
                    height_value, height_unit, align, layout_json
             FROM block_layouts
             WHERE file_id = ?1
             ORDER BY block_kind ASC, block_key ASC, occurrence_index ASC",
        )
        .map_err(|error| format!("failed to prepare block layout query: {error}"))?;

    let rows = statement
        .query_map(params![file_id], |row| {
            let layout_json: Option<String> = row.get(8)?;
            Ok(BlockLayoutPayload {
                file_path: file_path.to_string(),
                block_kind: row.get(0)?,
                block_key: row.get(1)?,
                occurrence_index: row.get(2)?,
                width_value: row.get(3)?,
                width_unit: row.get(4)?,
                height_value: row.get(5)?,
                height_unit: row.get(6)?,
                align: row.get(7)?,
                layout_json: layout_json
                    .as_deref()
                    .and_then(|value| serde_json::from_str(value).ok()),
            })
        })
        .map_err(|error| format!("failed to query block layouts: {error}"))?;

    let mut layouts = Vec::new();
    for row in rows {
        layouts.push(row.map_err(|error| format!("failed to read block layout row: {error}"))?);
    }

    Ok(layouts)
}

fn save_block_layout_to_metadata(layout: &BlockLayoutPayload) -> Result<(), String> {
    if layout.file_path.trim().is_empty() || layout.file_path.starts_with('~') || layout.file_path.starts_with("browser://") {
        return Err("block layout requires a saved local file path".to_string());
    }

    let connection = open_metadata_connection()?;
    let (workspace_id, canonical_root_path) = workspace_context_for_file(&connection, &layout.file_path)?;
    ensure_workspace(&connection, &workspace_id, &canonical_root_path)?;
    let display_name = file_name_from_path(&layout.file_path);
    let file_id = upsert_file(
        &connection,
        &workspace_id,
        &canonical_root_path,
        &layout.file_path,
        &display_name,
        None,
        current_timestamp_millis(),
    )?;

    let layout_id = stable_id(
        "block",
        &format!(
            "{}:{}:{}:{}",
            file_id, layout.block_kind, layout.block_key, layout.occurrence_index
        ),
    );
    let layout_json = layout
        .layout_json
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("failed to serialize block layout metadata: {error}"))?;
    let now = current_timestamp_millis();

    connection
        .execute(
            "INSERT INTO block_layouts
               (id, file_id, block_kind, block_key, occurrence_index, width_value,
                width_unit, height_value, height_unit, align, layout_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(file_id, block_kind, block_key, occurrence_index) DO UPDATE SET
               width_value = excluded.width_value,
               width_unit = excluded.width_unit,
               height_value = excluded.height_value,
               height_unit = excluded.height_unit,
               align = excluded.align,
               layout_json = excluded.layout_json,
               updated_at = excluded.updated_at",
            params![
                layout_id,
                file_id,
                layout.block_kind,
                layout.block_key,
                layout.occurrence_index,
                layout.width_value,
                normalized_unit(&layout.width_unit),
                layout.height_value,
                normalized_unit(&layout.height_unit),
                normalized_align(&layout.align),
                layout_json,
                now
            ],
        )
        .map_err(|error| format!("failed to save block layout metadata: {error}"))?;

    Ok(())
}

fn open_metadata_connection() -> Result<Connection, String> {
    let path = metadata_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create metadata directory: {error}"))?;
    }

    let connection = Connection::open(&path)
        .map_err(|error| format!("failed to open metadata database: {error}"))?;
    initialize_schema(&connection)?;
    Ok(connection)
}

fn initialize_schema(connection: &Connection) -> Result<(), String> {
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
            CREATE INDEX IF NOT EXISTS idx_block_layouts_file
              ON block_layouts(file_id, block_kind);
            ",
        )
        .map_err(|error| format!("failed to initialize metadata schema: {error}"))
}

fn find_file_for_path(
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

fn workspace_context_for_file(
    connection: &Connection,
    file_path: &str,
) -> Result<(String, String), String> {
    if let Some((workspace_id, canonical_root_path)) = active_workspace_context(connection)? {
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

fn active_workspace_context(connection: &Connection) -> Result<Option<(String, String)>, String> {
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

fn ensure_workspace(
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

fn save_recent_file(
    connection: &Connection,
    workspace_id: &str,
    canonical_root_path: &str,
    recent_file: &Value,
    fallback_time: i64,
) -> Result<(), String> {
    let Some(path) = recent_file.get("path").and_then(Value::as_str) else {
        return Ok(());
    };
    let opened_at = recent_file
        .get("openedAt")
        .and_then(Value::as_i64)
        .unwrap_or(fallback_time);
    let name = recent_file
        .get("name")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| file_name_from_path(path));
    upsert_file(
        connection,
        workspace_id,
        canonical_root_path,
        path,
        &name,
        None,
        opened_at,
    )
    .map(|_| ())
}

fn save_open_file(
    connection: &Connection,
    workspace_id: &str,
    view_id: &str,
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
    let content_hash = open_file
        .get("content")
        .and_then(Value::as_str)
        .map(|content| stable_hash(content));
    let file_id = upsert_file(
        connection,
        workspace_id,
        canonical_root_path,
        path,
        &name,
        content_hash.as_deref(),
        now,
    )?;
    let state_json = serde_json::to_string(open_file)
        .map_err(|error| format!("failed to serialize file session metadata: {error}"))?;
    let state_id = stable_id("fvs", &format!("{view_id}:{file_id}"));
    let is_active = file_id_from_session
        .zip(active_file_id)
        .map(|(file_id, active_file_id)| file_id == active_file_id)
        .unwrap_or(false);

    connection
        .execute(
            "INSERT INTO file_view_state
               (id, workspace_view_id, file_id, is_open, open_order, is_active, state_json, updated_at)
             VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7)
             ON CONFLICT(workspace_view_id, file_id) DO UPDATE SET
               is_open = excluded.is_open,
               open_order = excluded.open_order,
               is_active = excluded.is_active,
               state_json = excluded.state_json,
               updated_at = excluded.updated_at",
            params![state_id, view_id, file_id, index as i64, i64::from(is_active), state_json, now],
        )
        .map_err(|error| format!("failed to save file view state: {error}"))?;

    Ok(())
}

fn upsert_file(
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

fn load_open_files(connection: &Connection, view_id: &str) -> Result<Value, String> {
    let mut statement = connection
        .prepare(
            "SELECT state_json FROM file_view_state
             WHERE workspace_view_id = ?1 AND is_open = 1
             ORDER BY open_order ASC",
        )
        .map_err(|error| format!("failed to prepare open files query: {error}"))?;

    let rows = statement
        .query_map(params![view_id], |row| row.get::<_, String>(0))
        .map_err(|error| format!("failed to query open files: {error}"))?;

    let mut files = Vec::new();
    for row in rows {
        let state_json = row.map_err(|error| format!("failed to read open file row: {error}"))?;
        if let Ok(file) = serde_json::from_str::<Value>(&state_json) {
            files.push(file);
        }
    }

    Ok(Value::Array(files))
}

fn load_recent_files(connection: &Connection, workspace_id: &str) -> Result<Value, String> {
    let mut statement = connection
        .prepare(
            "SELECT absolute_path, display_name, last_opened_at FROM files
             WHERE workspace_id = ?1
             ORDER BY last_opened_at DESC
             LIMIT 50",
        )
        .map_err(|error| format!("failed to prepare recent files query: {error}"))?;

    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok(json!({
                "path": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "openedAt": row.get::<_, i64>(2)?,
            }))
        })
        .map_err(|error| format!("failed to query recent files: {error}"))?;

    let mut files = Vec::new();
    for row in rows {
        files.push(row.map_err(|error| format!("failed to read recent file row: {error}"))?);
    }

    Ok(Value::Array(files))
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

fn save_metadata_value(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
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
    path.parent().map(|parent| parent.to_string_lossy().to_string())
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

fn file_name_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("untitled.md")
        .to_string()
}

fn metadata_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Saekim")
        .join("metadata.sqlite3")
}

fn legacy_session_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Saekim")
        .join("session.json")
}

fn stable_id(prefix: &str, value: &str) -> String {
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

fn normalized_unit(value: &str) -> String {
    match value {
        "px" | "%" | "auto" => value.to_string(),
        _ => "auto".to_string(),
    }
}

fn normalized_align(value: &str) -> String {
    match value {
        "left" | "center" | "right" => value.to_string(),
        _ => "center".to_string(),
    }
}

fn current_timestamp_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn default_ui() -> Value {
    json!({
        "sidebarMode": "expanded",
        "sidebarViewMode": "files",
        "toolbarExpanded": true,
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
    use super::{relative_path, stable_hash};

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
}
