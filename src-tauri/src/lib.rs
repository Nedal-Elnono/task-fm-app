use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, WebviewWindow,
};

// Mod 30: persist last window position so drag position is remembered across hides
static LAST_POSITION: Mutex<Option<(i32, i32)>> = Mutex::new(None);

fn get_popup_window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    app.get_webview_window("main")
}

/// Corner radius (pt) of the popup window — matches macOS Tahoe's standard
/// window radius so the app sits next to Finder indistinguishably.
/// Keep in sync with the glow ring's border-radius in globals.css.
#[cfg(target_os = "macos")]
const POPUP_CORNER_RADIUS: f64 = 26.0;

/// Clip the popup window to an Apple-style continuous-corner squircle.
/// Public AppKit APIs only (window background + CALayer corner masking) —
/// no macos-private-api, so this is Mac App Store safe.
#[cfg(target_os = "macos")]
fn apply_squircle<R: Runtime>(window: &WebviewWindow<R>) {
    use objc2::{class, msg_send, runtime::AnyObject};
    use objc2_foundation::NSString;

    let Ok(ns_window) = window.ns_window() else { return };
    let ns_window = ns_window as *mut AnyObject;
    unsafe {
        let clear: *mut AnyObject = msg_send![class!(NSColor), clearColor];
        let _: () = msg_send![ns_window, setOpaque: false];
        let _: () = msg_send![ns_window, setBackgroundColor: clear];

        let content_view: *mut AnyObject = msg_send![ns_window, contentView];
        if content_view.is_null() {
            return;
        }
        let _: () = msg_send![content_view, setWantsLayer: true];
        let layer: *mut AnyObject = msg_send![content_view, layer];
        if layer.is_null() {
            return;
        }
        let _: () = msg_send![layer, setCornerRadius: POPUP_CORNER_RADIUS];
        let curve = NSString::from_str("continuous"); // kCACornerCurveContinuous
        let _: () = msg_send![layer, setCornerCurve: &*curve];
        let _: () = msg_send![layer, setMasksToBounds: true];
        let _: () = msg_send![ns_window, invalidateShadow];
    }
}

fn toggle_popup<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = get_popup_window(app) {
        if window.is_visible().unwrap_or(false) {
            // Save position before hiding
            if let Ok(pos) = window.outer_position() {
                if let Ok(mut last) = LAST_POSITION.lock() {
                    *last = Some((pos.x, pos.y));
                }
            }
            let _ = window.hide();
        } else {
            restore_or_position_popup(&window);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn restore_or_position_popup<R: Runtime>(window: &WebviewWindow<R>) {
    // If user has dragged the popup, restore last position
    if let Ok(last) = LAST_POSITION.lock() {
        if let Some((x, y)) = *last {
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            return;
        }
    }
    // First launch — position near tray
    position_popup_near_tray(window);
}

fn position_popup_near_tray<R: Runtime>(window: &WebviewWindow<R>) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let scale = monitor.scale_factor();
        let screen_w = monitor.size().width as f64 / scale;
        let screen_h = monitor.size().height as f64 / scale;
        let popup_w = 320.0_f64;  // matches default window width
        let popup_h = 500.0_f64;  // matches default window height

        // Mod 90: position for decorated window — window frame must clear macOS menu bar
        let x = (screen_w - popup_w - 8.0) as i32;

        #[cfg(target_os = "macos")]
        let y = 28_i32; // menu bar height (24px) + 4px gap — keeps title bar visible and draggable

        #[cfg(target_os = "windows")]
        let y = (screen_h - popup_h - 48.0) as i32;

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let y = 28_i32;

        let _ = (screen_h, popup_h);

        let _ = window.set_position(tauri::PhysicalPosition::new(
            (x as f64 * scale) as i32,
            (y as f64 * scale) as i32,
        ));
    }
}

// ─── Base64 encoder (no external crate) ──────────────────────────────────────

fn bytes_to_base64(bytes: &[u8]) -> String {
    const CHARS: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let n = match chunk.len() {
            1 => (chunk[0] as u32) << 16,
            2 => ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8),
            _ => ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8) | (chunk[2] as u32),
        };
        out.push(CHARS[((n >> 18) & 63) as usize] as char);
        out.push(CHARS[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARS[((n >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARS[(n & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn hide_popup(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

/// Copy bundled pack-resources into app-data/sounds on first run (or if pack is missing).
/// Returns number of packs copied.
fn setup_bundled_packs(app: &AppHandle) -> u32 {
    use std::fs;
    let resource_base = match app.path().resource_dir() {
        Ok(p) => p.join("pack-resources"),
        Err(_) => return 0,
    };
    let sounds_base = match app.path().app_data_dir() {
        Ok(p) => p.join("sounds"),
        Err(_) => return 0,
    };
    let Ok(pack_entries) = fs::read_dir(&resource_base) else { return 0; };
    let mut count = 0u32;
    for pack_entry in pack_entries.filter_map(|e| e.ok()) {
        let pack_id = pack_entry.file_name().to_string_lossy().to_string();
        if pack_id.starts_with('.') || pack_id == "__MACOSX" { continue; }
        let pack_dst = sounds_base.join(&pack_id);
        // Check if already installed (has any files)
        let already = fs::read_dir(&pack_dst)
            .ok()
            .map(|mut e| e.next().is_some())
            .unwrap_or(false);
        if already { continue; }
        // Copy all event folders
        let Ok(event_entries) = fs::read_dir(&pack_entry.path()) else { continue; };
        for event_entry in event_entries.filter_map(|e| e.ok()) {
            let event = event_entry.file_name().to_string_lossy().to_string();
            if event.starts_with('.') { continue; }
            let dst_event = pack_dst.join(&event);
            let _ = fs::create_dir_all(&dst_event);
            let Ok(files) = fs::read_dir(&event_entry.path()) else { continue; };
            for file in files.filter_map(|f| f.ok()) {
                let name = file.file_name();
                if name.to_string_lossy().starts_with('.') { continue; }
                let _ = fs::copy(file.path(), dst_event.join(&name));
            }
        }
        count += 1;
    }
    count
}

/// Read a sound file and return it as a data: URL (audio/mp4, audio/mpeg, etc.)
/// This bypasses the need for the asset:// protocol and works with any local file.
#[tauri::command]
fn read_sound_as_data_url(path: String) -> Result<String, String> {
    use std::fs;
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4")
        .to_lowercase();
    let mime = match ext.as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "m4a" | "aac" => "audio/aac",
        "mp4" => "audio/mp4",
        _ => "audio/mp4",
    };
    Ok(format!("data:{};base64,{}", mime, bytes_to_base64(&bytes)))
}

#[tauri::command]
fn get_sounds_dir(app: AppHandle) -> String {
    use std::fs;
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("sounds")
        .join("custom");
    for folder in &["taskCreated", "stepCompleted", "taskCompleted", "randomIdle"] {
        let _ = fs::create_dir_all(base.join(folder));
    }
    base.to_string_lossy().to_string()
}

#[tauri::command]
fn scan_sound_files(app: AppHandle, event: String) -> Vec<String> {
    use std::fs;
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("sounds")
        .join("custom")
        .join(&event);
    let Ok(entries) = fs::read_dir(&dir) else {
        return vec![];
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            name.ends_with(".mp4")
                || name.ends_with(".mp3")
                || name.ends_with(".wav")
                || name.ends_with(".ogg")
                || name.ends_with(".m4a")
                || name.ends_with(".aac")
        })
        .map(|e| e.path().to_string_lossy().to_string())
        .collect()
}

/// Extract a zip archive in-process. Runs inside the App Sandbox, unlike
/// spawning /usr/bin/unzip (child processes don't inherit file-access grants).
fn extract_zip(zip_path: &str, dest: &std::path::Path) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel_path) = entry.enclosed_name() else { continue };
        let out_path = dest.join(rel_path);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ─── Generic File Pack Commands ───────────────────────────────────────────────

/// Standard folder→event mappings shared by all file-based packs
fn pack_folder_mappings() -> &'static [(&'static str, &'static str)] {
    &[
        ("when creating new task", "taskCreated"),
        ("when step done ",        "stepCompleted"),
        ("when task done",         "taskCompleted"),
        ("when delete step",       "stepDeleted"),
        ("when delete task",       "taskDeleted"),
        ("mid day",                "randomIdle"),
        ("long time nothing done", "inactivityReminder"),
        ("if more than 3 steps",   "taskHasManyChecklistItems"),
    ]
}

/// Returns all pack IDs found in app_data/sounds/ (one dir per pack)
#[tauri::command]
fn list_sound_packs(app: AppHandle) -> Vec<String> {
    use std::fs;
    let sounds_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("sounds");
    let Ok(entries) = fs::read_dir(&sounds_dir) else { return vec![]; };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect()
}

/// Creates a new pack directory with all expected event sub-folders
#[tauri::command]
fn create_sound_pack(app: AppHandle, pack_id: String) -> Result<(), String> {
    use std::fs;
    if pack_id.trim().is_empty() || pack_id.contains('/') || pack_id.contains('\\') {
        return Err("Invalid pack ID".into());
    }
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sounds")
        .join(&pack_id);
    let events = [
        "taskCreated","stepCompleted","taskCompleted",
        "stepDeleted","taskDeleted","randomIdle",
        "inactivityReminder","taskHasManyChecklistItems",
    ];
    for ev in &events {
        fs::create_dir_all(base.join(ev)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_file_pack_dir(app: AppHandle, pack_id: String) -> String {
    app.path()
        .app_data_dir()
        .unwrap_or_default()
        .join("sounds")
        .join(&pack_id)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn scan_file_pack_files(app: AppHandle, pack_id: String, event: String) -> Vec<String> {
    use std::fs;
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("sounds")
        .join(&pack_id)
        .join(&event);
    let Ok(entries) = fs::read_dir(&dir) else { return vec![]; };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            name.ends_with(".mp3")
                || name.ends_with(".wav")
                || name.ends_with(".mp4")
                || name.ends_with(".m4a")
                || name.ends_with(".aac")
                || name.ends_with(".ogg")
        })
        .map(|e| e.path().to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
fn install_file_pack(app: AppHandle, pack_id: String, zip_path: String) -> Result<String, String> {
    use std::fs;

    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sounds")
        .join(&pack_id);

    for (_, event) in pack_folder_mappings() {
        fs::create_dir_all(base.join(event)).map_err(|e| e.to_string())?;
    }

    let tmp = std::env::temp_dir().join(format!("taskfm_{}_extract", pack_id));
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;

    extract_zip(&zip_path, &tmp)?;

    let source_root = fs::read_dir(&tmp)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .find(|e| e.file_name().to_string_lossy() != "__MACOSX" && e.path().is_dir())
        .map(|e| e.path())
        .unwrap_or(tmp.clone());

    for (zip_folder, event) in pack_folder_mappings() {
        let src = source_root.join(zip_folder);
        let dst = base.join(event);
        if let Ok(files) = fs::read_dir(&src) {
            for file in files.filter_map(|f| f.ok()) {
                let name = file.file_name();
                if name.to_string_lossy().starts_with('.') { continue; }
                let _ = fs::copy(file.path(), dst.join(&name));
            }
        }
    }

    let _ = fs::remove_dir_all(&tmp);
    Ok(base.to_string_lossy().to_string())
}

// ─── Mod 61: Add single sound file into a category ───────────────────────────

#[tauri::command]
fn add_sound_to_category(app: AppHandle, pack_id: String, event: String, src_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let dst_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sounds")
        .join(&pack_id)
        .join(&event);

    fs::create_dir_all(&dst_dir).map_err(|e| e.to_string())?;

    let src = Path::new(&src_path);
    let file_name = src
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?
        .to_string_lossy()
        .to_string();

    let dst = dst_dir.join(&file_name);
    fs::copy(src, &dst).map_err(|e| format!("Copy failed: {}", e))?;

    Ok(dst.to_string_lossy().to_string())
}

#[tauri::command]
fn remove_sound_from_category(file_path: String) -> Result<(), String> {
    std::fs::remove_file(&file_path).map_err(|e| e.to_string())
}

/// Fallback for file-picker upload: write raw bytes directly to category dir
#[tauri::command]
fn add_sound_bytes_to_category(
    app: AppHandle,
    pack_id: String,
    event: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    use std::fs;
    let dst_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sounds")
        .join(&pack_id)
        .join(&event);
    fs::create_dir_all(&dst_dir).map_err(|e| e.to_string())?;
    let dst = dst_dir.join(&file_name);
    fs::write(&dst, &bytes).map_err(|e| e.to_string())?;
    Ok(dst.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_sound_pack(app: AppHandle, pack_id: String) -> Result<(), String> {
    if pack_id.trim().is_empty() || pack_id.contains('/') || pack_id.contains('\\') {
        return Err("Invalid pack ID".into());
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sounds")
        .join(&pack_id);
    std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())
}

// ─── Elsisi Pack Commands (legacy — kept for backwards compat) ────────────────

#[tauri::command]
fn get_elsisi_dir(app: AppHandle) -> String {
    app.path()
        .app_data_dir()
        .unwrap_or_default()
        .join("sounds")
        .join("elsisi")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn scan_elsisi_files(app: AppHandle, event: String) -> Vec<String> {
    use std::fs;
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("sounds")
        .join("elsisi")
        .join(&event);
    let Ok(entries) = fs::read_dir(&dir) else {
        return vec![];
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            name.ends_with(".mp4")
                || name.ends_with(".mp3")
                || name.ends_with(".wav")
                || name.ends_with(".m4a")
                || name.ends_with(".aac")
        })
        .map(|e| e.path().to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
fn install_elsisi_pack(app: AppHandle, zip_path: String) -> Result<String, String> {
    use std::fs;

    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sounds")
        .join("elsisi");

    let mappings: &[(&str, &str)] = &[
        ("when creating new task", "taskCreated"),
        ("when step done ", "stepCompleted"),
        ("when task done", "taskCompleted"),
        ("when delete step", "stepDeleted"),
        ("when delete task", "taskDeleted"),
        ("mid day", "randomIdle"),
        ("long time nothing done", "inactivityReminder"),
        ("if more than 3 steps", "taskHasManyChecklistItems"),
    ];

    for (_, event) in mappings {
        fs::create_dir_all(base.join(event)).map_err(|e| e.to_string())?;
    }

    let tmp = std::env::temp_dir().join("taskfm_elsisi_extract");
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;

    extract_zip(&zip_path, &tmp)?;

    let source_root = fs::read_dir(&tmp)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .find(|e| {
            e.file_name().to_string_lossy() != "__MACOSX" && e.path().is_dir()
        })
        .map(|e| e.path())
        .unwrap_or(tmp.clone());

    for (zip_folder, event) in mappings {
        let src = source_root.join(zip_folder);
        let dst = base.join(event);
        if let Ok(files) = fs::read_dir(&src) {
            for file in files.filter_map(|f| f.ok()) {
                let name = file.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with('.') {
                    continue;
                }
                let _ = fs::copy(file.path(), dst.join(&name));
            }
        }
    }

    let _ = fs::remove_dir_all(&tmp);
    Ok(base.to_string_lossy().to_string())
}

/// Receives raw RGBA pixels (base64-encoded) from the frontend circle-wave
/// renderer and pushes them to the tray icon — drives the animated icon.
#[tauri::command]
fn update_tray_icon_rgba(
    app: AppHandle,
    rgba: String,
    width: u32,
    height: u32,
) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let bytes = STANDARD.decode(&rgba).map_err(|e| e.to_string())?;
    let img   = tauri::image::Image::new_owned(bytes, width, height);
    if let Some(tray) = app.tray_by_id("tray") {
        let _ = tray.set_icon(Some(img));
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build());
    #[cfg(not(feature = "mas"))]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());
    builder
        .setup(|app| {
            // macOS: show in both Dock and menu bar
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

            // Copy bundled sound packs to app-data on first run
            setup_bundled_packs(app.handle());

            // Position and show popup on startup
            if let Some(window) = get_popup_window(app.handle()) {
                #[cfg(target_os = "macos")]
                apply_squircle(&window);
                position_popup_near_tray(&window);
                let _ = window.show();
                let _ = window.set_focus();
            }

            // Transparent 44×44 placeholder — replaced immediately by the frontend
            // circle-wave renderer via update_tray_icon_rgba on first frame.
            let initial_icon = tauri::image::Image::new_owned(
                vec![0u8; 44 * 44 * 4],
                44,
                44,
            );

            let quit       = MenuItem::with_id(app, "quit",      "Quit TASK FM", true, None::<&str>)?;
            let show       = MenuItem::with_id(app, "show",      "Open TASK FM", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::with_id("tray")
                .icon(initial_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("TASK FM")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popup(tray.app_handle());
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => toggle_popup(app),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            hide_popup,
            read_sound_as_data_url,
            get_sounds_dir,
            scan_sound_files,
            get_elsisi_dir,
            scan_elsisi_files,
            install_elsisi_pack,
            get_file_pack_dir,
            scan_file_pack_files,
            install_file_pack,
            add_sound_to_category,
            remove_sound_from_category,
            list_sound_packs,
            create_sound_pack,
            delete_sound_pack,
            add_sound_bytes_to_category,
            update_tray_icon_rgba,
        ])
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app, event| {
            match event {
                // Mod 86: red close button hides window to tray instead of destroying it
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::CloseRequested { api, .. },
                    ..
                } if label == "main" => {
                    api.prevent_close();
                    if let Some(window) = app.get_webview_window(&label) {
                        if let Ok(pos) = window.outer_position() {
                            if let Ok(mut last) = LAST_POSITION.lock() {
                                *last = Some((pos.x, pos.y));
                            }
                        }
                        let _ = window.hide();
                    }
                }
                // Handle dock icon click (macOS) — show popup, restore last position
                tauri::RunEvent::Reopen { .. } => {
                    if let Some(window) = app.get_webview_window("main") {
                        restore_or_position_popup(&window);
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            }
        });
}
