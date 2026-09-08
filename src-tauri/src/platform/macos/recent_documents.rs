use std::ffi::CString;

use objc2::{
    msg_send,
    runtime::{AnyClass, AnyObject},
};
use tauri::AppHandle;

pub fn note_new(app: &AppHandle, path: &str) {
    let Ok(path) = CString::new(path) else {
        return;
    };

    let _ = app.run_on_main_thread(move || unsafe {
        let Some(string_class) = AnyClass::get(c"NSString") else {
            return;
        };
        let Some(url_class) = AnyClass::get(c"NSURL") else {
            return;
        };
        let Some(controller_class) = AnyClass::get(c"NSDocumentController") else {
            return;
        };

        let ns_path: *mut AnyObject = msg_send![string_class, stringWithUTF8String: path.as_ptr()];
        if ns_path.is_null() {
            return;
        }
        let file_url: *mut AnyObject = msg_send![url_class, fileURLWithPath: ns_path];
        let controller: *mut AnyObject = msg_send![controller_class, sharedDocumentController];
        if !file_url.is_null() && !controller.is_null() {
            let _: () = msg_send![controller, noteNewRecentDocumentURL: file_url];
        }
    });
}
