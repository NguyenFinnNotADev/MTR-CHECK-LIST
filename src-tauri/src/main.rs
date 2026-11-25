// MTR Check list by NguyenFinn — portable Tauri shell.
// All data lives next to the exe (or the nearest ancestor holding `database\` in dev).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::http::{Response, StatusCode};
use tauri::{WebviewUrl, WebviewWindowBuilder};

static APP_DIR: OnceLock<PathBuf> = OnceLock::new();

fn app_dir() -> &'static PathBuf {
    APP_DIR.get_or_init(|| {
        if let Ok(d) = std::env::var("MTR_APP_DIR") {
            return PathBuf::from(d);
        }
        let exe = std::env::current_exe().expect("exe path");
        let start = exe.parent().unwrap().to_path_buf();
        let mut cur: Option<&Path> = Some(&start);
        while let Some(d) = cur {
            if d.join("database").is_dir() {
                return d.to_path_buf();
            }
            cur = d.parent();
        }
        start
    })
}

/// Resolve a relative path inside the app folder; rejects absolute paths and `..`.
fn safe(rel: &str) -> Result<PathBuf, String> {
    let p = Path::new(rel);
    if p.is_absolute() || p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(format!("path not allowed: {rel}"));
    }
    Ok(app_dir().join(p))
}

fn stamp() -> String {
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    format!("{ms}")
}

#[tauri::command]
fn get_app_dir() -> String {
    app_dir().to_string_lossy().into_owned()
}

#[tauri::command]
fn read_text(rel: String) -> Result<Option<String>, String> {
    let p = safe(&rel)?;
    if !p.exists() {
        return Ok(None);
    }
    fs::read_to_string(&p).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text(rel: String, content: String, backup: bool) -> Result<(), String> {
    let p = safe(&rel)?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    if backup && p.exists() {
        let bdir = app_dir().join("data").join("backups");
        fs::create_dir_all(&bdir).map_err(|e| e.to_string())?;
        let base = rel.replace(['/', '\\'], "__");
        let _ = fs::copy(&p, bdir.join(format!("{base}.{}.bak", stamp())));
        // keep the 10 newest backups of this file
        if let Ok(rd) = fs::read_dir(&bdir) {
            let mut mine: Vec<PathBuf> = rd
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|q| q.file_name().map(|n| n.to_string_lossy().starts_with(&format!("{base}."))).unwrap_or(false))
                .collect();
            mine.sort();
            while mine.len() > 10 {
                let _ = fs::remove_file(mine.remove(0));
            }
        }
    }
    let tmp = p.with_extension("tmp");
    fs::write(&tmp, content.as_bytes()).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &p).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_dir(rel: String) -> Result<Vec<String>, String> {
    let p = safe(&rel)?;
    if !p.is_dir() {
        return Ok(vec![]);
    }
    let mut v: Vec<String> = fs::read_dir(p)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    v.sort();
    Ok(v)
}

#[tauri::command]
fn delete_file(rel: String) -> Result<(), String> {
    let p = safe(&rel)?;
    if p.exists() {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Read a user-picked file (import / backup restore). Read-only, outside the app folder allowed.
#[tauri::command]
fn read_external(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// Write a user-picked file (backup export).
#[tauri::command]
fn write_external(path: String, content: String) -> Result<(), String> {
    fs::write(path, content.as_bytes()).map_err(|e| e.to_string())
}

/// Copy an imported material list into data\imports\ and return its stored name.
#[tauri::command]
fn archive_import(path: String) -> Result<String, String> {
    let src = PathBuf::from(&path);
    let name = src.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "list.txt".into());
    let dir = app_dir().join("data").join("imports");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stored = format!("{}_{}", stamp(), name);
    fs::copy(&src, dir.join(&stored)).map_err(|e| e.to_string())?;
    Ok(stored)
}

#[tauri::command]
fn open_data_folder() -> Result<(), String> {
    let d = app_dir().join("data");
    let _ = fs::create_dir_all(&d);
    std::process::Command::new("explorer").arg(d).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Open (or focus) the small always-on-top window that shows items being collected.
/// Must be async: building a webview inside a sync command deadlocks on Windows (blank window).
#[tauri::command]
async fn open_mini(app: tauri::AppHandle, x: Option<f64>, y: Option<f64>, w: f64, h: f64, on_top: bool, hide_main: bool) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("mini") {
        let _ = win.show();
        let _ = win.set_focus();
    } else {
        let mut b = WebviewWindowBuilder::new(&app, "mini", WebviewUrl::App("index.html".into()))
            .title("MTR · Đang thu thập")
            .inner_size(w, h)
            .min_inner_size(260.0, 200.0)
            .always_on_top(on_top)
            .transparent(true)
            .skip_taskbar(false)
            .additional_browser_args(browser_args())
            .data_directory(app_dir().join("data").join(".webview"));
        b = match (x, y) {
            (Some(x), Some(y)) => b.position(x, y),
            _ => b.center(),
        };
        let win = b.build().map_err(|e| e.to_string())?;
        #[cfg(debug_assertions)]
        win.open_devtools();
        let handle = app.clone();
        let me = win.clone();
        win.on_window_event(move |ev| {
            // the page shows a "saving" screen, writes pending changes, then calls close_mini;
            // destroy anyway after 3 s in case the page is stuck
            if let tauri::WindowEvent::CloseRequested { api, .. } = ev {
                api.prevent_close();
                let _ = tauri::Emitter::emit_to(&me, "mini", "mtr-close-mini", ());
                let w = me.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(3000));
                    let _ = w.destroy();
                });
            }
            if let tauri::WindowEvent::Destroyed = ev {
                if let Some(main) = handle.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.unminimize();
                    let _ = main.set_focus();
                }
            }
        });
    }
    if hide_main {
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.hide();
            set_background(&main, true);
        }
    }
    Ok(())
}

#[tauri::command]
fn show_main(app: tauri::AppHandle) {
    use tauri::Manager;
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
        set_background(&main, false);
    }
}

#[tauri::command]
fn close_mini(app: tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("mini") {
        let _ = w.destroy();
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn relaunch(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
fn dir_exists(path: String) -> bool {
    Path::new(&path).is_dir()
}

/// Folders that look like Litematica material-list locations (…\config\litematica)
/// in common launchers: Modrinth, vanilla, CurseForge, Prism/MultiMC.
#[tauri::command]
fn find_litematica_dirs() -> Vec<String> {
    let mut roots: Vec<PathBuf> = vec![];
    let env = |k: &str| std::env::var(k).ok().map(PathBuf::from);
    if let Some(a) = env("APPDATA") {
        roots.push(a.join(".minecraft"));
        for sub in ["ModrinthApp\\profiles", "PrismLauncher\\instances", "PolyMC\\instances", ".technic\\modpacks"] {
            if let Ok(rd) = fs::read_dir(a.join(sub)) {
                for e in rd.flatten() {
                    let p = e.path();
                    roots.push(p.join(".minecraft"));
                    roots.push(p.join("minecraft"));
                    roots.push(p);
                }
            }
        }
    }
    if let Some(u) = env("USERPROFILE") {
        if let Ok(rd) = fs::read_dir(u.join("curseforge\\minecraft\\Instances")) {
            for e in rd.flatten() {
                roots.push(e.path());
            }
        }
    }
    let mut out = vec![];
    for r in roots {
        if r.join("config").join("litematica").is_dir() {
            let s = r.to_string_lossy().into_owned();
            if !out.contains(&s) {
                out.push(s);
            }
        }
    }
    out
}

/// Animation level saved in data\app.json ("off" | "lite" | "full"); read once at launch.
fn anim_level() -> &'static str {
    static LVL: OnceLock<String> = OnceLock::new();
    LVL.get_or_init(|| {
        let txt = fs::read_to_string(app_dir().join("data").join("app.json")).unwrap_or_default();
        let v: serde_json::Value = serde_json::from_str(&txt).unwrap_or(serde_json::Value::Null);
        match v.get("anim").and_then(|a| a.as_str()) {
            Some(s @ ("off" | "lite" | "full")) => s.to_string(),
            _ if v.get("animations").and_then(|a| a.as_bool()) == Some(false) => "off".into(),
            _ => "lite".into(),
        }
    })
}

/// WebView2 flags shared by both windows (same user-data folder ⇒ identical flags required).
/// Tauri's defaults + fewer background services + one renderer for main and mini.
/// "off"/"lite" draw on the CPU (no ~110 MB GPU process); "full" keeps the GPU for blur/motion.
fn browser_args() -> &'static str {
    static ARGS: OnceLock<String> = OnceLock::new();
    ARGS.get_or_init(|| {
        let mut a = String::from(
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,AutofillServerCommunication,Translate \
             --disable-background-networking --disable-component-update --disable-sync --disable-default-apps --no-first-run \
             --renderer-process-limit=1 --disable-breakpad --js-flags=--max-old-space-size=160",
        );
        if anim_level() != "full" {
            a.push_str(" --disable-gpu --disable-gpu-compositing --disable-software-rasterizer");
        }
        a
    })
}

/// Background mode while the window is hidden or minimized: tell WebView2 it is not visible
/// (rendering pauses) and ask it to trim memory (ICoreWebView2_19).
fn set_background(win: &tauri::WebviewWindow, bg: bool) {
    let _ = win.with_webview(move |wv| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        };
        use windows_core::Interface;
        let ctl = wv.controller();
        let _ = ctl.SetIsVisible(!bg);
        if let Ok(core) = ctl.CoreWebView2() {
            if let Ok(c19) = core.cast::<ICoreWebView2_19>() {
                let lvl = if bg { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
                let _ = c19.SetMemoryUsageTargetLevel(lvl);
            }
        }
    });
}

fn mime(p: &Path) -> &'static str {
    match p.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "png" => "image/png",
        "json" => "application/json",
        _ => "application/octet-stream",
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // http://mtr.localhost/icons/<id>.png → <app>\icons\<id>.png
        .register_uri_scheme_protocol("mtr", |_ctx, req| {
            let rel = req.uri().path().trim_start_matches('/').to_string();
            let rel = rel.replace("%20", " ");
            let ok = rel.starts_with("icons/") || rel.starts_with("database/");
            match (ok, safe(&rel)) {
                (true, Ok(p)) if p.is_file() => match fs::read(&p) {
                    Ok(b) => Response::builder()
                        .header("Content-Type", mime(&p))
                        .header("Cache-Control", "no-cache")
                        .body(b)
                        .unwrap(),
                    Err(_) => Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(vec![]).unwrap(),
                },
                _ => Response::builder().status(StatusCode::NOT_FOUND).body(vec![]).unwrap(),
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_dir, read_text, write_text, list_dir, delete_file,
            read_external, write_external, archive_import, open_data_folder, open_mini, show_main,
            close_mini, quit_app, relaunch, dir_exists, find_litematica_dirs
        ])
        .setup(|app| {
            let data = app_dir().join("data");
            let _ = fs::create_dir_all(data.join("projects"));
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("MTR Check list by NguyenFinn")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 640.0)
                .center()
                .additional_browser_args(browser_args())
                .data_directory(data.join(".webview"))
                .build()?;
            // closing the main window quits the whole app (mini included): the page shows a
            // "saving" screen, flushes, then calls quit_app; exit anyway after 5 s.
            // Losing focus asks WebView2 to trim memory (the user is usually in-game).
            let handle = app.handle().clone();
            if let Some(main) = tauri::Manager::get_webview_window(app, "main") {
                let me = main.clone();
                main.on_window_event(move |ev| match ev {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = tauri::Emitter::emit(&handle, "mtr-quit", ());
                        let h = handle.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(5000));
                            h.exit(0);
                        });
                    }
                    tauri::WindowEvent::Resized(_) => {
                        let min = me.is_minimized().unwrap_or(false);
                        set_background(&me, min);
                    }
                    tauri::WindowEvent::Focused(true) => set_background(&me, false),
                    _ => {}
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MTR Check list");
}
