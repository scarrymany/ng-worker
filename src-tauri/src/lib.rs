mod thumbs;

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "ng-worker-data.json";
const BACKUPS_KEPT: usize = 10;

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Reads the saved state. Returns an empty string on first launch.
#[tauri::command]
fn load_data(app: AppHandle) -> Result<String, String> {
    let path = data_dir(&app)?.join(DATA_FILE);
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

/// Writes the state atomically (temp file + rename) so a crash never leaves a half-written file.
#[tauri::command]
fn save_data(app: AppHandle, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("bad json: {e}"))?;
    let dir = data_dir(&app)?;
    let tmp = dir.join(format!("{DATA_FILE}.tmp"));
    fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, dir.join(DATA_FILE)).map_err(|e| e.to_string())
}

/// Keeps a dated copy of the state once per day, pruning old ones.
#[tauri::command]
fn daily_backup(app: AppHandle, day: String, json: String) -> Result<(), String> {
    let dir = data_dir(&app)?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join(format!("backup-{day}.json"));
    if !file.exists() {
        fs::write(file, json).map_err(|e| e.to_string())?;
    }
    let mut files: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .collect();
    files.sort();
    while files.len() > BACKUPS_KEPT {
        let _ = fs::remove_file(files.remove(0));
    }
    Ok(())
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

/// Scans the NGLauncher cache (read-only) for cdn.ng-gta5.com image URLs of items, vehicles,
/// clothes and properties. Never touches the game process.
#[tauri::command]
fn scan_game_cache() -> Result<Vec<String>, String> {
    let local = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA не задано".to_string())?;
    let root = PathBuf::from(local).join("NGLauncher").join("data");
    if !root.exists() {
        return Err("Не знайдено NGLauncher. Запустіть гру хоча б раз.".into());
    }
    let dirs = [root.join("nui-storage"), root.join("server-cache"), root.join("server-cache-priv")];
    let mut found = std::collections::BTreeSet::new();
    let mut stack: Vec<PathBuf> = dirs.into_iter().filter(|d| d.exists()).collect();
    let needle = b"cdn.ng-gta5.com/";
    let mut budget: u64 = 2_000_000_000; // don't read more than ~2 GB
    while let Some(dir) = stack.pop() {
        let Ok(rd) = fs::read_dir(&dir) else { continue };
        for entry in rd.flatten() {
            let path = entry.path();
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                stack.push(path);
                continue;
            }
            if meta.len() > 200_000_000 || meta.len() > budget {
                continue;
            }
            let Ok(bytes) = fs::read(&path) else { continue };
            budget -= meta.len();
            let mut i = 0;
            while i + needle.len() <= bytes.len() {
                if &bytes[i..i + needle.len()] == needle {
                    let mut j = i + needle.len();
                    while j < bytes.len() {
                        let c = bytes[j];
                        if c.is_ascii_alphanumeric() || b"/._-%".contains(&c) { j += 1 } else { break }
                    }
                    if let Ok(tail) = std::str::from_utf8(&bytes[i + needle.len()..j]) {
                        let ok_kind = ["items/", "vehicles/", "properties/", "clothes_male/", "clothes_female/"].iter().any(|p| tail.starts_with(p));
                        let ok_ext = tail.ends_with(".webp") || tail.ends_with(".png");
                        if ok_kind && ok_ext {
                            found.insert(format!("https://cdn.ng-gta5.com/{tail}"));
                        }
                    }
                    i = j;
                } else {
                    i += 1;
                }
            }
        }
    }
    Ok(found.into_iter().collect())
}

#[tauri::command]
fn data_location(app: AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol("thumb", |ctx, request, responder| {
            let cache = ctx
                .app_handle()
                .path()
                .app_cache_dir()
                .unwrap_or_else(|_| std::env::temp_dir())
                .join("thumbs");
            let path = request.uri().path().to_string();
            // Work off the UI thread: downloads and resizing can take a moment.
            std::thread::spawn(move || responder.respond(thumbs::handle(cache, &path)));
        })
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            daily_backup,
            write_file,
            read_file,
            data_location,
            scan_game_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running NG Worker");
}
