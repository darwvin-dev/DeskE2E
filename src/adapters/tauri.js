import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { cssSelector } from '../selector.js';

export class TauriAdapter {
  constructor(app) { this.config = app; this.browser = null; this.cleanup = null; }
  async start() {
    let service;
    try {
      const fromApp = createRequire(pathToFileURL(path.join(this.config.cwd ?? process.cwd(), 'package.json')));
      try { service = await import(pathToFileURL(fromApp.resolve('@wdio/tauri-service')).href); } catch { service = await import('@wdio/tauri-service'); }
    } catch {
      throw new Error('Tauri requires @wdio/tauri-service installed in the target app. The embedded provider also requires tauri-plugin-wdio-webdriver in the app.');
    }
    if (typeof service.startWdioSession !== 'function') throw new Error('Installed @wdio/tauri-service does not expose startWdioSession. Update it.');
    this.cleanup = service.cleanupWdioSession;
    this.browser = await service.startWdioSession({
      browserName: 'tauri',
      'tauri:options': { application: this.config.executablePath, args: this.config.args ?? [] },
    }, { driverProvider: this.config.driverProvider ?? 'embedded' });
  }
  async element(selector) { return this.browser.$(cssSelector(selector)); }
  async click(selector, timeout) { const el = await this.element(selector); await el.waitForClickable({ timeout }); await el.click(); }
  async fill(selector, text, timeout) { const el = await this.element(selector); await el.waitForDisplayed({ timeout }); await el.setValue(text); }
  async text(selector, timeout) { const el = await this.element(selector); await el.waitForDisplayed({ timeout }); return el.getText(); }
  async value(selector, timeout) { const el = await this.element(selector); await el.waitForDisplayed({ timeout }); return el.getValue(); }
  async press(key) { await this.browser.keys(key.split('+')); }
  async expectVisible(selector, visible, timeout) {
    const el = await this.element(selector);
    await el.waitForDisplayed({ timeout, reverse: !visible });
  }
  async screenshot(filename) { await this.browser.saveScreenshot(filename); }
  async selectWindow(index) {
    const windows = await this.browser.getWindowHandles();
    if (!windows[index]) throw new Error(`Window ${index} is not available (${windows.length} open)`);
    await this.browser.switchToWindow(windows[index]);
  }
  async snapshot() {
    return this.browser.execute(() => ({
      title: document.title,
      text: document.body?.innerText?.slice(0, 10000) ?? '',
      controls: [...document.querySelectorAll('button,input,select,textarea,a,[role="button"],[data-testid]')].slice(0, 100).map(e => ({
        tag: e.tagName.toLowerCase(), id: e.id || undefined, testId: e.getAttribute('data-testid') || undefined,
        label: e.getAttribute('aria-label') || undefined,
        text: (e.matches('input,textarea') ? '[input content omitted]' : (e.innerText || '').slice(0, 120)),
      })),
    }));
  }
  async close() {
    if (this.browser) {
      try { if (typeof this.cleanup === 'function') await this.cleanup(this.browser); else await this.browser.deleteSession(); }
      finally { this.browser = null; }
    }
  }
}
