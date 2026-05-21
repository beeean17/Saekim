use std::{
    ffi::{CStr, CString},
    os::raw::c_char,
    path::PathBuf,
    sync::OnceLock,
};

use objc2::{
    msg_send,
    runtime::{AnyClass, AnyObject, ClassBuilder, Sel},
    sel,
};
use tauri::{AppHandle, Emitter, Manager};

use crate::{app_state::AppState, is_supported_document_path, EVENT_OPEN_EXTERNAL_FILES};

const K_CORE_EVENT_CLASS: u32 = u32::from_be_bytes(*b"aevt");
const K_AE_OPEN_DOCUMENTS: u32 = u32::from_be_bytes(*b"odoc");
const KEY_DIRECT_OBJECT: u32 = u32::from_be_bytes(*b"----");

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static HANDLER_OBJECT: OnceLock<usize> = OnceLock::new();

pub fn install(app: &AppHandle) {
    let _ = APP_HANDLE.set(app.clone());

    let Some(handler) = open_document_handler() else {
        return;
    };

    let manager_class = AnyClass::get(c"NSAppleEventManager").expect("NSAppleEventManager class");
    let manager: *mut AnyObject = unsafe { msg_send![manager_class, sharedAppleEventManager] };

    unsafe {
        let _: () = msg_send![
            manager,
            setEventHandler: handler,
            andSelector: sel!(handleOpenDocuments:withReplyEvent:),
            forEventClass: K_CORE_EVENT_CLASS,
            andEventID: K_AE_OPEN_DOCUMENTS
        ];
    }
}

fn open_document_handler() -> Option<*mut AnyObject> {
    let existing = HANDLER_OBJECT.get().copied();
    if let Some(handler) = existing {
        return Some(handler as *mut AnyObject);
    }

    let cls = handler_class()?;
    let handler: *mut AnyObject = unsafe { msg_send![cls, new] };
    let _ = HANDLER_OBJECT.set(handler as usize);
    Some(handler)
}

fn handler_class() -> Option<&'static AnyClass> {
    if let Some(cls) = AnyClass::get(c"SaekimOpenDocumentHandler") {
        return Some(cls);
    }

    let superclass = AnyClass::get(c"NSObject")?;
    let name = CString::new("SaekimOpenDocumentHandler").ok()?;
    let mut builder = ClassBuilder::new(&name, superclass)?;
    unsafe {
        builder.add_method(
            sel!(handleOpenDocuments:withReplyEvent:),
            handle_open_documents as extern "C-unwind" fn(_, _, _, _),
        );
    }

    Some(builder.register())
}

extern "C-unwind" fn handle_open_documents(
    _this: &AnyObject,
    _sel: Sel,
    event: *mut AnyObject,
    _reply_event: *mut AnyObject,
) {
    let paths = apple_event_file_paths(event);
    if !paths.is_empty() {
        queue_open_files(paths);
    }
}

fn apple_event_file_paths(event: *mut AnyObject) -> Vec<String> {
    if event.is_null() {
        return Vec::new();
    }

    let direct_object: *mut AnyObject =
        unsafe { msg_send![event, paramDescriptorForKeyword: KEY_DIRECT_OBJECT] };
    if direct_object.is_null() {
        return Vec::new();
    }

    let count: isize = unsafe { msg_send![direct_object, numberOfItems] };
    if count <= 0 {
        return descriptor_path(direct_object)
            .filter(|path| is_supported_document_path(&PathBuf::from(path)))
            .into_iter()
            .collect();
    }

    (1..=count)
        .filter_map(|index| {
            let descriptor: *mut AnyObject =
                unsafe { msg_send![direct_object, descriptorAtIndex: index] };
            descriptor_path(descriptor)
        })
        .filter(|path| is_supported_document_path(&PathBuf::from(path)))
        .collect()
}

fn descriptor_path(descriptor: *mut AnyObject) -> Option<String> {
    if descriptor.is_null() {
        return None;
    }

    let file_url: *mut AnyObject = unsafe { msg_send![descriptor, fileURLValue] };
    if !file_url.is_null() {
        let path: *mut AnyObject = unsafe { msg_send![file_url, path] };
        if let Some(path) = nsstring_to_string(path) {
            return Some(path);
        }
    }

    let string_value: *mut AnyObject = unsafe { msg_send![descriptor, stringValue] };
    nsstring_to_string(string_value)
}

fn nsstring_to_string(value: *mut AnyObject) -> Option<String> {
    if value.is_null() {
        return None;
    }

    let c_string: *const c_char = unsafe { msg_send![value, UTF8String] };
    if c_string.is_null() {
        return None;
    }

    unsafe { CStr::from_ptr(c_string) }
        .to_str()
        .ok()
        .map(ToOwned::to_owned)
}

fn queue_open_files(paths: Vec<String>) {
    let Some(app) = APP_HANDLE.get() else {
        return;
    };

    let state = app.state::<AppState>();
    if let Ok(mut pending) = state.pending_open_files.lock() {
        pending.extend(paths.iter().cloned());
    }

    let _ = app.emit(EVENT_OPEN_EXTERNAL_FILES, paths);
}
