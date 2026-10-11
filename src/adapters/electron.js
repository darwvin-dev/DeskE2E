import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSelector } from '../selector.js';

export class ElectronAdapter {
  constructor(app) { this.config = app; this.application = null; this.window = null; }
  async start() {
    let playwright;
    try {
      const requireFromApp = createRequire(pathToFileURL(path.join(this.config.cwd ?? process.cwd(), 'package.json')));
      try { playwright = requireFromApp('playwright'); } catch { playwright = await import('playwright'); }
    } catch {
      throw new Error('Playwright is required for Electron. Run `npm install -D playwright` in your desktop project.');
    }
    this.application = await playwright._electron.launch({
      executablePath: this.config.executablePath,
      args: this.config.args ?? [],
      cwd: this.config.cwd ?? process.cwd(),
      timeout: this.config.timeoutMs ?? 30000,
    });
    this.window = await this.application.firstWindow({ timeout: this.config.timeoutMs ?? 30000 });
  }
  locator(selector) {
    const {kind, value} = parseSelector(selector);
    return kind === 'testid' ? this.window.getByTestId(value) : this.window.locator(value);
  }
  async click(selector, timeout) { await this.locator(selector).click({ timeout }); }
  async fill(selector, text, timeout) { await this.locator(selector).fill(text, { timeout }); }
  async text(selector, timeout) { return this.locator(selector).innerText({ timeout }); }
  async value(selector, timeout) { return this.locator(selector).inputValue({ timeout }); }
  async press(key) { await this.window.keyboard.press(key); }
  async expectVisible(selector, visible, timeout) {
    await this.locator(selector).waitFor({ state: visible ? 'visible' : 'hidden', timeout });
  }
  async screenshot(filename) { await this.window.screenshot({ path: filename }); }
  async selectWindow(index) {
    const windows = this.application.windows();
    if (!windows[index]) throw new Error(`Window ${index} is not available (${windows.length} open)`);
    this.window = windows[index];
  }
  async snapshot() {
    return this.window.evaluate(() => ({
      title: document.title,
      text: document.body?.innerText?.slice(0, 10000) ?? '',
      controls: [...document.querySelectorAll('button,input,select,textarea,a,[role="button"],[data-testid]')].slice(0, 100).map((e) => ({
        tag: e.tagName.toLowerCase(), id: e.id || undefined, testId: e.getAttribute('data-testid') || undefined,
        label: e.getAttribute('aria-label') || undefined,
        text: (e.matches('input,textarea') ? '[input content omitted]' : (e.innerText || '').slice(0, 120)),
      })),
    }));
  }
  async close() { if (this.application) { await this.application.close(); this.application = null; } }
}
