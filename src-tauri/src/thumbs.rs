//! `thumb://` protocol: downloads a cdn.ng-gta5.com image once, shrinks it to card size and keeps
//! it in the app cache folder. Cards then decode small files instead of 1280px photos while scrolling.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::{Cursor, Read};
use std::path::PathBuf;

use image::{DynamicImage, GenericImageView, ImageFormat};
use tauri::http::{Response, StatusCode};

const ALLOWED_HOST: &str = "https://cdn.ng-gta5.com/";
const MAX_DOWNLOAD: u64 = 15 * 1024 * 1024;

fn decode_percent(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn respond(status: StatusCode, mime: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("Content-Type", mime)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .header("Access-Control-Allow-Origin", "*")
        .body(body)
        .unwrap()
}

fn encode(img: &DynamicImage) -> Result<(Vec<u8>, &'static str), String> {
    let mut buf = Cursor::new(Vec::new());
    let has_alpha = img.color().has_alpha()
        && img.to_rgba8().pixels().any(|p| p.0[3] < 250);
    if has_alpha {
        img.write_to(&mut buf, ImageFormat::Png).map_err(|e| e.to_string())?;
        Ok((buf.into_inner(), "image/png"))
    } else {
        let rgb = img.to_rgb8();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 84)
            .encode_image(&rgb)
            .map_err(|e| e.to_string())?;
        Ok((buf.into_inner(), "image/jpeg"))
    }
}

fn make(cache: &PathBuf, width: u32, url: &str) -> Result<(Vec<u8>, &'static str), String> {
    if !url.starts_with(ALLOWED_HOST) {
        return Err("host not allowed".into());
    }
    let mut h = DefaultHasher::new();
    url.hash(&mut h);
    let key = format!("{width}_{:016x}", h.finish());
    for (ext, mime) in [("png", "image/png"), ("jpg", "image/jpeg")] {
        let p = cache.join(format!("{key}.{ext}"));
        if let Ok(b) = fs::read(&p) {
            return Ok((b, mime));
        }
    }
    let resp = ureq::get(url)
        .set("User-Agent", "NG-Worker")
        .timeout(std::time::Duration::from_secs(20))
        .call()
        .map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    resp.into_reader().take(MAX_DOWNLOAD).read_to_end(&mut raw).map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&raw).map_err(|e| e.to_string())?;
    let (w, hgt) = img.dimensions();
    let img = if w > width { img.thumbnail(width, (hgt as u64 * width as u64 / w.max(1) as u64) as u32 + 1) } else { img };
    let (bytes, mime) = encode(&img)?;
    let ext = if mime == "image/png" { "png" } else { "jpg" };
    let _ = fs::create_dir_all(cache);
    let _ = fs::write(cache.join(format!("{key}.{ext}")), &bytes);
    Ok((bytes, mime))
}

/// Path format: /<width>/<percent-encoded source url>
pub fn handle(cache: PathBuf, path: &str) -> Response<Vec<u8>> {
    let path = path.trim_start_matches('/');
    let Some((w, rest)) = path.split_once('/') else {
        return respond(StatusCode::BAD_REQUEST, "text/plain", b"bad path".to_vec());
    };
    let width = w.parse::<u32>().unwrap_or(360).clamp(64, 1280);
    let url = decode_percent(rest);
    match make(&cache, width, &url) {
        Ok((bytes, mime)) => respond(StatusCode::OK, mime, bytes),
        Err(e) => respond(StatusCode::BAD_GATEWAY, "text/plain", e.into_bytes()),
    }
}
