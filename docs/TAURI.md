# Tauri 2 integration

DeskE2E drives the actual compiled application via `@wdio/tauri-service`. The *embedded* provider requires the `tauri-plugin-wdio-webdriver` Rust plugin to be enabled in test builds. Never ship a production binary with an unprotected remote-control endpoint.

1. In your Tauri app, configure a Cargo feature only for the test driver:

   ```toml
   [features]
   webdriver = ["dep:tauri-plugin-wdio-webdriver"]
   [dependencies]
   tauri-plugin-wdio-webdriver = { version = "0.2", optional = true }
   ```

2. Conditionally install the plugin in your Tauri builder:

   ```rust
   let builder = tauri::Builder::default();
   #[cfg(feature = "webdriver")]
   let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
   builder.run(tauri::generate_context!()).expect("app failed");
   ```

3. Build with `cargo build --release --features webdriver`. **Do not distribute this special test binary**. Install `@wdio/tauri-service` alongside DeskE2E, and configure `app.driverProvider: "embedded"` in your scenario file.

4. Run `deske2e run --config your-tauri.json` in an authenticated local development session. The embedded driver requires a graphical session; use Xvfb on Linux CI.

This repository contains a minimal Tauri smoke fixture and an opt-in workflow at `.github/workflows/tauri-smoke.yml`. The CI is manual until it has been verified on GitHub runners. macOS is supported by the upstream embedded provider but not yet tested by DeskE2E CI. Native system dialogs and tray menus are not covered by renderer CSS selectors.

Official references: https://tauri.app/develop/tests/webdriver/ and https://webdriver.io/docs/desktop-testing/tauri/quick-start
