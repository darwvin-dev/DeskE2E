#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    let builder = tauri::Builder::default();
    #[cfg(feature = "webdriver")]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    builder.run(tauri::generate_context!()).expect("Tauri smoke fixture failed to start");
}
