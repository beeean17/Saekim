use tauri::{
    menu::{AboutMetadata, IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, EventTarget, Manager, Wry,
};

const MENU_SAVE: &str = "save";
const MENU_SAVE_AS: &str = "save-as";
const MENU_PRINT: &str = "print";
const MENU_EXPORT_PDF: &str = "export-pdf";
const MENU_NEW_FILE: &str = "new-file";
const MENU_NEW_WINDOW: &str = "new-window";
const MENU_OPEN_FILE: &str = "open-file";
const MENU_OPEN_FOLDER: &str = "open-folder";
const MENU_OPEN_RECENT_WORKSPACE_PREFIX: &str = "open-recent-workspace:";
const MENU_CLOSE_FILE: &str = "close-file";
const MENU_CLOSE_WINDOW: &str = "close-window";
const MENU_QUIT: &str = "quit";
const EVENT_SAVE: &str = "saekim-menu-save";
const EVENT_SAVE_AS: &str = "saekim-menu-save-as";
const EVENT_PRINT: &str = "saekim-menu-print";
const EVENT_EXPORT_PDF: &str = "saekim-menu-export-pdf";
const EVENT_NEW_FILE: &str = "saekim-menu-new-file";
const EVENT_NEW_WINDOW: &str = "saekim-menu-new-window";
const EVENT_OPEN_FILE: &str = "saekim-menu-open-file";
const EVENT_OPEN_FOLDER: &str = "saekim-menu-open-folder";
const EVENT_OPEN_RECENT_WORKSPACE: &str = "saekim-menu-open-recent-workspace";
const EVENT_CLOSE_FILE: &str = "saekim-menu-close-file";
const EVENT_CLOSE_WINDOW: &str = "saekim-menu-close-window";

pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let package_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(package_info.name.clone()),
        version: Some(package_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        ..Default::default()
    };

    let save = MenuItem::with_id(app, MENU_SAVE, "Save", true, Some("CmdOrCtrl+S"))?;
    let new_file = MenuItem::with_id(app, MENU_NEW_FILE, "New File", true, Some("CmdOrCtrl+N"))?;
    let new_window = MenuItem::with_id(
        app,
        MENU_NEW_WINDOW,
        "New Window",
        true,
        Some("CmdOrCtrl+Shift+N"),
    )?;
    let open_file = MenuItem::with_id(
        app,
        MENU_OPEN_FILE,
        "Open File...",
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let open_folder = MenuItem::with_id(
        app,
        MENU_OPEN_FOLDER,
        "Open Folder...",
        true,
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let open_recent_workspace = recent_workspace_submenu(app)?;
    let save_as = MenuItem::with_id(
        app,
        MENU_SAVE_AS,
        "Save As...",
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let export_pdf = MenuItem::with_id(
        app,
        MENU_EXPORT_PDF,
        "Export PDF",
        true,
        Some("CmdOrCtrl+Shift+E"),
    )?;
    let print = MenuItem::with_id(app, MENU_PRINT, "Print...", true, Some("CmdOrCtrl+P"))?;
    let close_file = MenuItem::with_id(
        app,
        MENU_CLOSE_FILE,
        "Close File",
        true,
        Some("CmdOrCtrl+W"),
    )?;
    let close_window = MenuItem::with_id(
        app,
        MENU_CLOSE_WINDOW,
        "Close Window",
        true,
        Some("CmdOrCtrl+Shift+W"),
    )?;
    let quit = MenuItem::with_id(
        app,
        MENU_QUIT,
        format!("Quit {}", package_info.name),
        true,
        Some("CmdOrCtrl+Q"),
    )?;

    let app_menu = Submenu::with_items(
        app,
        package_info.name.clone(),
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_file,
            &new_window,
            &PredefinedMenuItem::separator(app)?,
            &open_file,
            &open_folder,
            &open_recent_workspace,
            &PredefinedMenuItem::separator(app)?,
            &save,
            &save_as,
            &PredefinedMenuItem::separator(app)?,
            &print,
            &export_pdf,
            &PredefinedMenuItem::separator(app)?,
            &close_file,
        ],
    )?;
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(app, None)?],
    )?;
    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &close_window,
        ],
    )?;
    let help_menu = Submenu::with_items(app, "Help", true, &[])?;

    Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )
}

pub(crate) fn refresh_menu(app: &AppHandle) {
    match build_menu(app).and_then(|menu| app.set_menu(menu)) {
        Ok(_) => eprintln!("[saekim:native-menu] refreshed menu"),
        Err(error) => eprintln!("[saekim:native-menu] failed to refresh menu: {error}"),
    }
}

pub fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    let menu_id = event.id().as_ref();
    eprintln!("[saekim:native-menu] selected id={menu_id}");

    if menu_id == MENU_QUIT {
        crate::request_app_exit(app);
        return;
    }

    if let Some(workspace_id) = menu_id.strip_prefix(MENU_OPEN_RECENT_WORKSPACE_PREFIX) {
        let Some(path) = crate::commands::session::recent_workspace_path(app, workspace_id) else {
            eprintln!("[saekim:native-menu] ignored missing recent workspace id={workspace_id}");
            return;
        };
        emit_menu_event(app, EVENT_OPEN_RECENT_WORKSPACE, MenuPayload::String(path));
        return;
    }

    let Some(event_name) = menu_event_name(menu_id) else {
        eprintln!("[saekim:native-menu] ignored id={menu_id}");
        return;
    };

    emit_menu_event(app, event_name, MenuPayload::Unit);
}

fn emit_menu_event(app: &AppHandle, event_name: &str, payload: MenuPayload) {
    let Some(target_label) = target_window_label(app) else {
        eprintln!("[saekim:native-menu] target window not found for event={event_name}");
        return;
    };

    match emit_to_webview_window_target(app, &target_label, event_name, &payload) {
        Ok(()) => eprintln!(
            "[saekim:native-menu] emitted webview window event={event_name} target={target_label}"
        ),
        Err(error) => eprintln!(
            "[saekim:native-menu] failed to emit target webview window event={event_name}: {error}"
        ),
    }
}

enum MenuPayload {
    Unit,
    String(String),
}

fn emit_to_webview_window_target(
    app: &AppHandle,
    target_label: &str,
    event_name: &str,
    payload: &MenuPayload,
) -> tauri::Result<()> {
    match payload {
        MenuPayload::Unit => app.emit_to(EventTarget::webview_window(target_label), event_name, ()),
        MenuPayload::String(value) => {
            app.emit_to(EventTarget::webview_window(target_label), event_name, value)
        }
    }
}

fn recent_workspace_submenu(app: &AppHandle) -> tauri::Result<Submenu<Wry>> {
    let recent_workspaces = crate::commands::session::recent_workspace_menu_entries(app);
    let mut items = Vec::new();

    if recent_workspaces.is_empty() {
        items.push(MenuItem::with_id(
            app,
            "open-recent-workspace-empty",
            "No Recent Workspaces",
            false,
            None::<&str>,
        )?);
    } else {
        for workspace in recent_workspaces {
            items.push(MenuItem::with_id(
                app,
                format!("{MENU_OPEN_RECENT_WORKSPACE_PREFIX}{}", workspace.id),
                recent_workspace_label(&workspace.name, &workspace.path),
                true,
                None::<&str>,
            )?);
        }
    }

    let item_refs: Vec<&dyn IsMenuItem<Wry>> = items
        .iter()
        .map(|item| item as &dyn IsMenuItem<Wry>)
        .collect();
    Submenu::with_items(app, "Open Recent Workspace", true, &item_refs)
}

fn recent_workspace_label(name: &str, path: &str) -> String {
    if name.trim().is_empty() {
        path.to_string()
    } else {
        name.to_string()
    }
}

fn target_window_label(app: &AppHandle) -> Option<String> {
    crate::active_window_label(app)
        .filter(|label| app.get_webview_window(label).is_some())
        .or_else(|| app.get_webview_window("main").map(|_| "main".to_string()))
        .or_else(|| app.webview_windows().into_keys().next())
}

fn menu_event_name(menu_id: &str) -> Option<&'static str> {
    match menu_id {
        MENU_SAVE => Some(EVENT_SAVE),
        MENU_SAVE_AS => Some(EVENT_SAVE_AS),
        MENU_PRINT => Some(EVENT_PRINT),
        MENU_EXPORT_PDF => Some(EVENT_EXPORT_PDF),
        MENU_NEW_FILE => Some(EVENT_NEW_FILE),
        MENU_NEW_WINDOW => Some(EVENT_NEW_WINDOW),
        MENU_OPEN_FILE => Some(EVENT_OPEN_FILE),
        MENU_OPEN_FOLDER => Some(EVENT_OPEN_FOLDER),
        MENU_CLOSE_FILE => Some(EVENT_CLOSE_FILE),
        MENU_CLOSE_WINDOW => Some(EVENT_CLOSE_WINDOW),
        _ => None,
    }
}
