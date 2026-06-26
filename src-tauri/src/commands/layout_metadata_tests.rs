use super::*;

use rusqlite::Connection;
use serde_json::{json, Value};

const FILE_ID: &str = "file-layout-test";
const FILE_PATH: &str = "/tmp/layout-test.md";

#[test]
fn layout_box_sql_accepts_ui_group_updates() {
    let connection = setup_connection();
    let first_layout = sample_layout(37.5, 1);

    save_layout_change(&connection, &first_layout, 1_000);
    save_layout_change(&connection, &sample_layout(50.0, 0), 2_000);

    let layouts =
        load_document_layout_boxes_from_metadata(&connection, FILE_ID, FILE_PATH).unwrap();
    assert_eq!(layouts.len(), 1);

    let layout = &layouts[0];
    assert_eq!(layout.file_path, FILE_PATH);
    assert_eq!(layout.block_kind, "image");
    assert_eq!(layout.block_key, "image:block-1");
    assert_eq!(layout.width_value, Some(50.0));
    assert_eq!(layout.width_unit, "%");
    assert_eq!(
        layout
            .layout_json
            .as_ref()
            .and_then(|value| value.get("groupIndex"))
            .and_then(Value::as_i64),
        Some(0),
    );

    let box_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM document_layout_boxes", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(box_count, 1);

    let group_item = connection
        .query_row(
            "SELECT group_index, width_value, width_unit FROM document_layout_group_items",
            [],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .unwrap();
    assert_eq!(group_item, (0, 50.0, "%".to_string()));
}

fn setup_connection() -> Connection {
    let connection = Connection::open_in_memory().unwrap();
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;
            CREATE TABLE files (id TEXT PRIMARY KEY);
            ",
        )
        .unwrap();
    initialize_schema(&connection).unwrap();
    connection
        .execute("INSERT INTO files (id) VALUES (?1)", [FILE_ID])
        .unwrap();
    connection
}

fn save_layout_change(connection: &Connection, layout: &BlockLayoutPayload, now: i64) {
    let profile_id = upsert_document_layout_profile(connection, FILE_ID, now).unwrap();
    let box_row_id = upsert_document_layout_box(connection, &profile_id, layout, now).unwrap();
    save_document_layout_group_membership(connection, &profile_id, &box_row_id, layout, now)
        .unwrap();
    prune_empty_document_layout_groups(connection).unwrap();
}

fn sample_layout(width_value: f64, group_index: i64) -> BlockLayoutPayload {
    BlockLayoutPayload {
        file_path: FILE_PATH.to_string(),
        block_kind: "image".to_string(),
        block_key: "image:block-1".to_string(),
        occurrence_index: 0,
        box_id: Some("box-image-1".to_string()),
        box_kind: Some("image".to_string()),
        flow: Some("document-flow".to_string()),
        x_value: None,
        y_value: None,
        width_value: Some(width_value),
        width_unit: "%".to_string(),
        height_value: None,
        height_unit: "auto".to_string(),
        align: "left".to_string(),
        z_index: Some(1),
        source_line: Some(7),
        source_end_line: Some(9),
        content_hash: Some("content-hash".to_string()),
        identity_hash: Some("identity-hash".to_string()),
        layout_json: Some(json!({
            "groupId": "manual-group",
            "groupMode": "manual",
            "groupColumns": 2,
            "groupIndex": group_index,
        })),
    }
}
