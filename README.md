# DeskE2E

**Desktop end-to-end testing that your AI coding agent can operate — and your CI can replay.**

DeskE2E is an open-source local-first CLI and MCP tool server for testing real [Electron](https://www.electronjs.org/) and [Tauri](https://tauri.app/) desktop applications. It drives actual app windows, records repeatable UI steps, captures failure screenshots, and writes portable JSON/HTML reports. No hosted account, model API key or cloud runner required to replay saved tests.

> **Status: v0.2 developer preview.** Real Electron smoke passed in previous CI runs; this update adds stronger scenarios, MCP argument validation, and a Tauri test fixture. The Tauri test workflow is opt-in and has **not yet been verified in CI**. Native dialogs, tray menus, automatic bug discovery and all-platform E2E remain future work.

## Quick start

Use Node.js 20+. While the package is not published on npm, clone this repository and run `npm link` to make `deske2e` available locally.

```bash
npm link
# In your Electron or Tauri project:
deske2e init --framework electron --app ./node_modules/.bin/electron
# or: deske2e init --framework tauri --app ./src-tauri/target/release/my-app
deske2e doctor
deske2e run
```

For **Electron**, install `playwright` in the tested project, ensure Electron is installed, and set `app.args` to the application's entrypoint, commonly `["."]`. The `app.executablePath` must be the actual Electron binary, not a JavaScript file.

For **Tauri**, see [the Tauri setup guide](docs/TAURI.md). Install `@wdio/tauri-service` in the tested project and set up its [embedded driver](https://v2.tauri.app/develop/tests/webdriver/) (recommended on Windows, Linux and macOS). `app.executablePath` must point to the built application. For Linux/Windows the external driver can also be used by setting `app.driverProvider` to `external` and installing its prerequisites.

Selectors support ordinary CSS, `css:main button`, and stable `testid:save` syntax (mapped to `data-testid="save"` on both frameworks). Use test IDs for regression scenarios.

CLI exit codes: `0` all passed, `1` one or more scenarios failed, `2` invalid configuration/runtime command.

## Scenario format

`deske2e.config.json` is explicit and designed for review in pull requests:

```json
{
  "version": 1,
  "framework": "electron",
  "app": {
    "executablePath": "./node_modules/.bin/electron",
    "args": ["."],
    "cwd": "."
  },
  "scenarios": [{
    "name": "Settings persist",
    "steps": [
      {"action": "click", "selector": "[data-testid='settings']"},
      {"action": "fill", "selector": "[data-testid='display-name']", "text": "Alice"},
      {"action": "click", "selector": "[data-testid='save']"},
      {"action": "expectText", "selector": "[data-testid='status']", "text": "Saved"},
      {"action": "screenshot", "name": "saved-settings"}
    ]
  }]
}
```

Supported actions: `click`, `fill`, `expectText` (contains), `expectVisible`, `expectHidden`, `expectValue` (exact input value), `press` (keyboard shortcut), `wait` (milliseconds), `selectWindow` (zero-based index) and `screenshot`. Per-step `timeoutMs` overrides the 10-second default. Each scenario launches a new desktop process/session for isolation. A failed assertion creates a screenshot and **does not prevent later scenarios from running**.

```bash
deske2e run --config deske2e.config.json --output deske2e-results
# Open deske2e-results/report.html
```

## AI agent integration (MCP)

DeskE2E exposes a local [Model Context Protocol](https://modelcontextprotocol.io/) stdio server. Add this to Claude Code / a compatible MCP client (use the absolute executable path when not globally linked):

```json
{
  "mcpServers": {
    "deske2e": {
      "command": "deske2e",
      "args": ["mcp"]
    }
  }
}
```

Available tools: `deske2e_launch`, `deske2e_snapshot`, `deske2e_click`, `deske2e_fill`, `deske2e_assert_text`, `deske2e_assert_value`, `deske2e_press`, `deske2e_select_window`, `deske2e_screenshot`, `deske2e_save_test`, `deske2e_close`. An agent can inspect visible text/controls, take deliberate actions, record them, and write a regression scenario for replay without AI. Screenshots are local paths; this protocol surface does not upload them.

The MCP server can operate your desktop app **with your OS account's permissions**. Saved tests record filled text as plain JSON; never record passwords, access tokens or confidential customer data. Snapshots omit raw input values, but may expose visible text and screenshots. Only connect agents you trust. Test in a disposable user profile or VM, never with production credentials. The MCP integration is a minimal stdio implementation, not a complete implementation of every optional MCP feature.

## What DeskE2E does not do yet

- Native OS dialogs or tray/menu automation. Playwright's Electron integration cannot intercept native dialogs without test-specific stubs.
- Coordinate-based mouse control, OCR or image matching. CSS selectors within a webview are used deliberately.
- Automatic bug discovery or LLM reasoning. Your own coding agent decides what to try via the tools above.
- Tauri CI is opt-in (`Tauri smoke (opt-in)` under Actions); it is not yet verified. The Electron smoke uses a compiled runtime in CI.

## Developing

```bash
npm run check
npm test
```

Contributions welcome: focus areas are stable accessibility selectors, native dialogs, traces, privacy/redaction, reproducible desktop CI examples and adapter conformance tests.

## License

Apache-2.0, see [LICENSE](LICENSE).

## Roadmap / current limitations

- [x] Electron renderer E2E through Playwright and a CI smoke fixture
- [x] Scenario replay and artifact output without an LLM
- [x] Agent-facing MCP stdio tools with argument validation
- [x] Stable `testid:` selectors, input assertions, keyboard shortcuts
- [x] Optional minimal Tauri 2 fixture and opt-in CI workflow
- [ ] Validate Tauri fixture on GitHub-hosted Linux and Windows GUI runners
- [ ] System tray, native dialogs, multi-window lifecycle and accessibility inspection
- [ ] Console/video/trace collection and configurable secrets redaction
- [ ] Autonomous exploration, plan verification and test generation benchmark across real apps
- [ ] npm publication and signed release artifacts

This is an experimental testing toolkit, not a security sandbox. Only run agents against disposable app profiles and trusted test data.
