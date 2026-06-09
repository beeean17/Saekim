use tauri::{
    menu::{AboutMetadata, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, EventTarget, Manager, WebviewWindow, Wry,
};

const MENU_SAVE: &str = "save";
const MENU_SAVE_AS: &str = "save-as";
const MENU_EXPORT_PDF: &str = "export-pdf";
const MENU_NEW_FILE: &str = "new-file";
const MENU_NEW_WINDOW: &str = "new-window";
const MENU_OPEN_FILE: &str = "open-file";
const MENU_OPEN_FOLDER: &str = "open-folder";
const EVENT_SAVE: &str = "saekim-menu-save";
const EVENT_SAVE_AS: &str = "saekim-menu-save-as";
const EVENT_EXPORT_PDF: &str = "saekim-menu-export-pdf";
const EVENT_NEW_FILE: &str = "saekim-menu-new-file";
const EVENT_NEW_WINDOW: &str = "saekim-menu-new-window";
const EVENT_OPEN_FILE: &str = "saekim-menu-open-file";
const EVENT_OPEN_FOLDER: &str = "saekim-menu-open-folder";

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
        Some("CmdOrCtrl+P"),
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
            &PredefinedMenuItem::quit(app, None)?,
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
            &PredefinedMenuItem::separator(app)?,
            &save,
            &save_as,
            &PredefinedMenuItem::separator(app)?,
            &export_pdf,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
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
            &PredefinedMenuItem::close_window(app, None)?,
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

pub fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    let menu_id = event.id().as_ref();
    eprintln!("[saekim:native-menu] selected id={menu_id}");

    let Some(event_name) = menu_event_name(menu_id) else {
        eprintln!("[saekim:native-menu] ignored id={menu_id}");
        return;
    };

    let Some((target_label, window)) = target_window(app) else {
        eprintln!("[saekim:native-menu] target window not found for event={event_name}");
        return;
    };

    match app.emit_to(EventTarget::window(&target_label), event_name, ()) {
        Ok(()) => eprintln!("[saekim:native-menu] emitted target window event={event_name}"),
        Err(error) => eprintln!(
            "[saekim:native-menu] failed to emit target window event={event_name}: {error}"
        ),
    }

    match app.emit_to(
        EventTarget::webview_window(&target_label),
        event_name,
        (),
    ) {
        Ok(()) => {
            eprintln!("[saekim:native-menu] emitted target webview window event={event_name}")
        }
        Err(error) => eprintln!(
            "[saekim:native-menu] failed to emit target webview window event={event_name}: {error}"
        ),
    }

    match window.emit(event_name, ()) {
        Ok(()) => eprintln!("[saekim:native-menu] emitted window event={event_name}"),
        Err(error) => {
            eprintln!("[saekim:native-menu] failed to emit window event={event_name}: {error}")
        }
    }

    dispatch_dom_event(&window, event_name);
}

fn dispatch_dom_event(window: &WebviewWindow<Wry>, event_name: &str) {
    let script = format!("window.dispatchEvent(new CustomEvent({event_name:?}));");
    match window.eval(script) {
        Ok(()) => eprintln!("[saekim:native-menu] dispatched dom event={event_name}"),
        Err(error) => {
            eprintln!("[saekim:native-menu] failed to dispatch dom event={event_name}: {error}")
        }
    }
}

fn target_window(app: &AppHandle) -> Option<(String, WebviewWindow<Wry>)> {
    crate::active_window_label(app)
        .and_then(|label| app.get_webview_window(&label).map(|window| (label, window)))
        .or_else(|| {
            app.get_webview_window("main")
                .map(|window| ("main".to_string(), window))
        })
        .or_else(|| app.webview_windows().into_iter().next())
}

fn menu_event_name(menu_id: &str) -> Option<&'static str> {
    match menu_id {
        MENU_SAVE => Some(EVENT_SAVE),
        MENU_SAVE_AS => Some(EVENT_SAVE_AS),
        MENU_EXPORT_PDF => Some(EVENT_EXPORT_PDF),
        MENU_NEW_FILE => Some(EVENT_NEW_FILE),
        MENU_NEW_WINDOW => Some(EVENT_NEW_WINDOW),
        MENU_OPEN_FILE => Some(EVENT_OPEN_FILE),
        MENU_OPEN_FOLDER => Some(EVENT_OPEN_FOLDER),
        _ => None,
    }
}
