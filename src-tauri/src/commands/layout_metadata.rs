use std::collections::HashSet;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{file::CommandResult, session};

const DEFAULT_LAYOUT_PROFILE_KEY: &str = "default";
const DEFAULT_LAYOUT_RENDERER_KIND: &str = "markdown";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockLayoutPayload {
    file_path: String,
    block_kind: String,
    block_key: String,
    occurrence_index: i64,
    box_id: Option<String>,
    box_kind: Option<String>,
    flow: Option<String>,
    x_value: Option<f64>,
    y_value: Option<f64>,
    width_value: Option<f64>,
    width_unit: String,
    height_value: Option<f64>,
    height_unit: String,
    align: String,
    z_index: Option<i64>,
    source_line: Option<i64>,
    source_end_line: Option<i64>,
    content_hash: Option<String>,
    identity_hash: Option<String>,
    layout_json: Option<Value>,
}

#[tauri::command]
pub fn load_block_layouts(
    app: tauri::AppHandle,
    file_path: String,
) -> CommandResult<Vec<BlockLayoutPayload>> {
    match load_block_layouts_from_metadata(&app, &file_path) {
        Ok(layouts) => ok(layouts),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn save_block_layout(
    app: tauri::AppHandle,
    window: tauri::Window,
    layout: BlockLayoutPayload,
) -> CommandResult<Option<()>> {
    match save_block_layouts_to_metadata(&app, window.label(), &[layout]) {
        Ok(()) => ok(Some(())),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn save_block_layouts(
    app: tauri::AppHandle,
    window: tauri::Window,
    layouts: Vec<BlockLayoutPayload>,
) -> CommandResult<Option<()>> {
    match save_block_layouts_to_metadata(&app, window.label(), &layouts) {
        Ok(()) => ok(Some(())),
        Err(error) => fail(error),
    }
}

pub(super) fn initialize_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS document_layout_profiles (
              id TEXT PRIMARY KEY,
              file_id TEXT NOT NULL,
              profile_key TEXT NOT NULL DEFAULT 'default',
              renderer_kind TEXT NOT NULL DEFAULT 'markdown',
              schema_version INTEGER NOT NULL DEFAULT 2,
              scene_id TEXT,
              document_hash TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(file_id, profile_key, renderer_kind),
              FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS document_layout_boxes (
              id TEXT PRIMARY KEY,
              profile_id TEXT NOT NULL,
              box_id TEXT NOT NULL,
              box_kind TEXT NOT NULL,
              block_kind TEXT NOT NULL,
              block_key TEXT NOT NULL,
              occurrence_index INTEGER NOT NULL DEFAULT 0,
              flow TEXT NOT NULL DEFAULT 'document-flow',
              x_value REAL,
              y_value REAL,
              width_value REAL,
              width_unit TEXT NOT NULL DEFAULT '%',
              height_value REAL,
              height_unit TEXT NOT NULL DEFAULT 'auto',
              align TEXT NOT NULL DEFAULT 'left',
              z_index INTEGER NOT NULL DEFAULT 0,
              source_line INTEGER,
              source_end_line INTEGER,
              content_hash TEXT,
              identity_hash TEXT,
              layout_json TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(profile_id, box_id),
              FOREIGN KEY(profile_id) REFERENCES document_layout_profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS document_layout_groups (
              id TEXT PRIMARY KEY,
              profile_id TEXT NOT NULL,
              group_key TEXT NOT NULL,
              group_mode TEXT NOT NULL DEFAULT 'auto',
              columns INTEGER NOT NULL DEFAULT 2,
              template_json TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(profile_id, group_key),
              FOREIGN KEY(profile_id) REFERENCES document_layout_profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS document_layout_group_items (
              group_id TEXT NOT NULL,
              box_id TEXT NOT NULL,
              group_index INTEGER NOT NULL,
              width_value REAL,
              width_unit TEXT NOT NULL DEFAULT '%',
              PRIMARY KEY(group_id, box_id),
              FOREIGN KEY(group_id) REFERENCES document_layout_groups(id) ON DELETE CASCADE,
              FOREIGN KEY(box_id) REFERENCES document_layout_boxes(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_document_layout_boxes_profile
              ON document_layout_boxes(profile_id, block_kind);
            CREATE INDEX IF NOT EXISTS idx_document_layout_groups_profile
              ON document_layout_groups(profile_id);
            CREATE INDEX IF NOT EXISTS idx_document_layout_group_items_order
              ON document_layout_group_items(group_id, group_index);
            ",
        )
        .map_err(|error| format!("failed to initialize layout metadata schema: {error}"))
}

fn load_block_layouts_from_metadata(
    app: &tauri::AppHandle,
    file_path: &str,
) -> Result<Vec<BlockLayoutPayload>, String> {
    let connection = session::open_metadata_connection(app)?;
    let Some((file_id, _workspace_id)) = session::find_file_for_path(&connection, file_path)?
    else {
        return Ok(Vec::new());
    };

    let mut layouts = load_document_layout_boxes_from_metadata(&connection, &file_id, file_path)?;
    let legacy_layouts = load_legacy_block_layouts_from_metadata(&connection, &file_id, file_path)?;
    if layouts.is_empty() {
        return Ok(legacy_layouts);
    }

    let mut layout_keys = layouts
        .iter()
        .map(block_layout_identity_key)
        .collect::<HashSet<_>>();
    for legacy_layout in legacy_layouts {
        if layout_keys.insert(block_layout_identity_key(&legacy_layout)) {
            layouts.push(legacy_layout);
        }
    }

    Ok(layouts)
}

fn load_document_layout_boxes_from_metadata(
    connection: &Connection,
    file_id: &str,
    file_path: &str,
) -> Result<Vec<BlockLayoutPayload>, String> {
    let mut statement = connection
        .prepare(
            "SELECT boxes.box_id, boxes.box_kind, boxes.block_kind, boxes.block_key,
                    boxes.occurrence_index, boxes.flow, boxes.x_value, boxes.y_value,
                    boxes.width_value, boxes.width_unit, boxes.height_value, boxes.height_unit,
                    boxes.align, boxes.z_index, boxes.source_line, boxes.source_end_line,
                    boxes.content_hash, boxes.identity_hash, boxes.layout_json
             FROM document_layout_profiles profiles
             JOIN document_layout_boxes boxes ON boxes.profile_id = profiles.id
             WHERE profiles.file_id = ?1
               AND profiles.profile_key = ?2
               AND profiles.renderer_kind = ?3
             ORDER BY boxes.block_kind ASC, boxes.block_key ASC, boxes.occurrence_index ASC",
        )
        .map_err(|error| format!("failed to prepare document layout query: {error}"))?;

    let rows = statement
        .query_map(
            params![
                file_id,
                DEFAULT_LAYOUT_PROFILE_KEY,
                DEFAULT_LAYOUT_RENDERER_KIND
            ],
            |row| {
                let layout_json: Option<String> = row.get(18)?;
                Ok(BlockLayoutPayload {
                    file_path: file_path.to_string(),
                    box_id: row.get(0)?,
                    box_kind: row.get(1)?,
                    block_kind: row.get(2)?,
                    block_key: row.get(3)?,
                    occurrence_index: row.get(4)?,
                    flow: row.get(5)?,
                    x_value: row.get(6)?,
                    y_value: row.get(7)?,
                    width_value: row.get(8)?,
                    width_unit: row.get(9)?,
                    height_value: row.get(10)?,
                    height_unit: row.get(11)?,
                    align: row.get(12)?,
                    z_index: row.get(13)?,
                    source_line: row.get(14)?,
                    source_end_line: row.get(15)?,
                    content_hash: row.get(16)?,
                    identity_hash: row.get(17)?,
                    layout_json: layout_json
                        .as_deref()
                        .and_then(|value| serde_json::from_str(value).ok()),
                })
            },
        )
        .map_err(|error| format!("failed to query document layouts: {error}"))?;

    let mut layouts = Vec::new();
    for row in rows {
        layouts.push(row.map_err(|error| format!("failed to read document layout row: {error}"))?);
    }

    Ok(layouts)
}

fn load_legacy_block_layouts_from_metadata(
    connection: &Connection,
    file_id: &str,
    file_path: &str,
) -> Result<Vec<BlockLayoutPayload>, String> {
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
                box_id: None,
                box_kind: None,
                flow: None,
                x_value: None,
                y_value: None,
                width_value: row.get(3)?,
                width_unit: row.get(4)?,
                height_value: row.get(5)?,
                height_unit: row.get(6)?,
                align: row.get(7)?,
                z_index: None,
                source_line: None,
                source_end_line: None,
                content_hash: None,
                identity_hash: None,
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

fn save_block_layouts_to_metadata(
    app: &tauri::AppHandle,
    window_label: &str,
    layouts: &[BlockLayoutPayload],
) -> Result<(), String> {
    if layouts.is_empty() {
        return Ok(());
    }

    for layout in layouts {
        if layout.file_path.trim().is_empty()
            || layout.file_path.starts_with('~')
            || layout.file_path.starts_with("browser://")
        {
            return Err("block layout requires a saved local file path".to_string());
        }
    }

    let mut connection = session::open_metadata_connection(app)?;
    let now = session::current_timestamp_millis();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("failed to start block layout transaction: {error}"))?;

    for layout in layouts {
        let (workspace_id, canonical_root_path) =
            session::workspace_context_for_file(&transaction, window_label, &layout.file_path)?;
        session::ensure_workspace(&transaction, &workspace_id, &canonical_root_path)?;
        let display_name = session::file_name_from_path(&layout.file_path);
        let file_id = session::upsert_file(
            &transaction,
            &workspace_id,
            &canonical_root_path,
            &layout.file_path,
            &display_name,
            None,
            now,
        )?;
        let profile_id = upsert_document_layout_profile(&transaction, &file_id, now)?;
        let box_row_id = upsert_document_layout_box(&transaction, &profile_id, layout, now)?;
        save_document_layout_group_membership(&transaction, &profile_id, &box_row_id, layout, now)?;
    }

    prune_empty_document_layout_groups(&transaction)?;
    session::save_metadata_value(
        &transaction,
        "schema_version",
        &session::SCHEMA_VERSION.to_string(),
    )?;

    transaction
        .commit()
        .map_err(|error| format!("failed to commit block layout metadata: {error}"))?;

    Ok(())
}

fn upsert_document_layout_profile(
    connection: &Connection,
    file_id: &str,
    now: i64,
) -> Result<String, String> {
    let profile_id = session::stable_id(
        "layout_profile",
        &format!("{file_id}:{DEFAULT_LAYOUT_PROFILE_KEY}:{DEFAULT_LAYOUT_RENDERER_KIND}"),
    );

    connection
        .execute(
            "INSERT INTO document_layout_profiles
               (id, file_id, profile_key, renderer_kind, schema_version, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
             ON CONFLICT(file_id, profile_key, renderer_kind) DO UPDATE SET
               schema_version = excluded.schema_version,
               updated_at = excluded.updated_at",
            params![
                profile_id,
                file_id,
                DEFAULT_LAYOUT_PROFILE_KEY,
                DEFAULT_LAYOUT_RENDERER_KIND,
                session::SCHEMA_VERSION,
                now
            ],
        )
        .map_err(|error| format!("failed to save layout profile metadata: {error}"))?;

    Ok(profile_id)
}

fn upsert_document_layout_box(
    connection: &Connection,
    profile_id: &str,
    layout: &BlockLayoutPayload,
    now: i64,
) -> Result<String, String> {
    let box_id = layout_box_id(layout);
    let box_row_id = session::stable_id("layout_box", &format!("{profile_id}:{box_id}"));
    let layout_json = layout
        .layout_json
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("failed to serialize block layout metadata: {error}"))?;
    let box_kind = layout
        .box_kind
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| default_box_kind(&layout.block_kind).to_string());

    connection
        .execute(
            "INSERT INTO document_layout_boxes
               (id, profile_id, box_id, box_kind, block_kind, block_key, occurrence_index,
                flow, x_value, y_value, width_value, width_unit, height_value, height_unit,
                align, z_index, source_line, source_end_line, content_hash, identity_hash,
                layout_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                     ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?22)
             ON CONFLICT(profile_id, box_id) DO UPDATE SET
               box_kind = excluded.box_kind,
               block_kind = excluded.block_kind,
               block_key = excluded.block_key,
               occurrence_index = excluded.occurrence_index,
               flow = excluded.flow,
               x_value = excluded.x_value,
               y_value = excluded.y_value,
               width_value = excluded.width_value,
               width_unit = excluded.width_unit,
               height_value = excluded.height_value,
               height_unit = excluded.height_unit,
               align = excluded.align,
               z_index = excluded.z_index,
               source_line = excluded.source_line,
               source_end_line = excluded.source_end_line,
               content_hash = excluded.content_hash,
               identity_hash = excluded.identity_hash,
               layout_json = excluded.layout_json,
               updated_at = excluded.updated_at",
            params![
                box_row_id,
                profile_id,
                box_id,
                box_kind,
                layout.block_kind,
                layout.block_key,
                layout.occurrence_index,
                normalized_flow(layout.flow.as_deref()),
                layout.x_value,
                layout.y_value,
                layout.width_value,
                session::normalized_unit(&layout.width_unit),
                layout.height_value,
                session::normalized_unit(&layout.height_unit),
                session::normalized_align(&layout.align),
                layout.z_index.unwrap_or(0),
                layout.source_line,
                layout.source_end_line,
                layout.content_hash,
                layout.identity_hash,
                layout_json,
                now
            ],
        )
        .map_err(|error| format!("failed to save layout box metadata: {error}"))?;

    Ok(box_row_id)
}

fn save_document_layout_group_membership(
    connection: &Connection,
    profile_id: &str,
    box_row_id: &str,
    layout: &BlockLayoutPayload,
    now: i64,
) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM document_layout_group_items
             WHERE box_id = ?1
               AND group_id IN (
                 SELECT id FROM document_layout_groups WHERE profile_id = ?2
               )",
            params![box_row_id, profile_id],
        )
        .map_err(|error| format!("failed to reset layout group membership: {error}"))?;

    let Some(group) = layout_group_from_json(layout.layout_json.as_ref()) else {
        return Ok(());
    };

    let group_id = session::stable_id("layout_group", &format!("{profile_id}:{}", group.group_key));
    connection
        .execute(
            "INSERT INTO document_layout_groups
               (id, profile_id, group_key, group_mode, columns, template_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?6)
             ON CONFLICT(profile_id, group_key) DO UPDATE SET
               group_mode = excluded.group_mode,
               columns = excluded.columns,
               updated_at = excluded.updated_at",
            params![
                group_id,
                profile_id,
                group.group_key,
                group.group_mode,
                group.columns,
                now
            ],
        )
        .map_err(|error| format!("failed to save layout group metadata: {error}"))?;

    connection
        .execute(
            "INSERT INTO document_layout_group_items
               (group_id, box_id, group_index, width_value, width_unit)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(group_id, box_id) DO UPDATE SET
               group_index = excluded.group_index,
               width_value = excluded.width_value,
               width_unit = excluded.width_unit",
            params![
                group_id,
                box_row_id,
                group.group_index,
                layout.width_value,
                session::normalized_unit(&layout.width_unit)
            ],
        )
        .map_err(|error| format!("failed to save layout group item metadata: {error}"))?;

    Ok(())
}

fn prune_empty_document_layout_groups(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM document_layout_groups
             WHERE id NOT IN (
               SELECT DISTINCT group_id FROM document_layout_group_items
             )",
            [],
        )
        .map_err(|error| format!("failed to prune empty layout groups: {error}"))?;
    Ok(())
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

fn normalized_flow(value: Option<&str>) -> String {
    match value {
        Some("freeform") => "freeform".to_string(),
        _ => "document-flow".to_string(),
    }
}

fn block_layout_identity_key(layout: &BlockLayoutPayload) -> String {
    format!(
        "{}:{}:{}",
        layout.block_kind, layout.block_key, layout.occurrence_index
    )
}

fn layout_box_id(layout: &BlockLayoutPayload) -> String {
    if let Some(box_id) = layout
        .box_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        return box_id.to_string();
    }

    if layout.block_key.starts_with("preview-box:") {
        return layout.block_key.clone();
    }

    session::stable_id("box", &block_layout_identity_key(layout))
}

fn default_box_kind(block_kind: &str) -> &'static str {
    match block_kind {
        "image" => "image",
        "table" => "table",
        "katex" => "katex",
        "code" | "mermaid" => "markdown",
        _ => "text",
    }
}

struct LayoutGroupMetadata {
    group_key: String,
    group_mode: String,
    columns: i64,
    group_index: i64,
}

fn layout_group_from_json(layout_json: Option<&Value>) -> Option<LayoutGroupMetadata> {
    let object = layout_json?.as_object()?;
    let group_key = object
        .get("groupId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?
        .to_string();
    let group_mode = object
        .get("groupMode")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("auto")
        .to_string();
    let columns = object
        .get("groupColumns")
        .and_then(json_i64)
        .filter(|value| *value > 0)
        .unwrap_or(2);
    let group_index = object
        .get("groupIndex")
        .and_then(json_i64)
        .filter(|value| *value >= 0)
        .unwrap_or(0);

    Some(LayoutGroupMetadata {
        group_key,
        group_mode,
        columns,
        group_index,
    })
}

fn json_i64(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|number| i64::try_from(number).ok()))
        .or_else(|| value.as_f64().map(|number| number.round() as i64))
}
