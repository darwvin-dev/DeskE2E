// Minimal MCP stdio JSON-RPC transport: no hosted services, no model API key.
// One running desktop session per MCP process. All actions are explicit agent tool calls.
import readline from 'node:readline';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig, validateConfig } from './config.js';
import { parseSelector } from './selector.js';
import { makeAdapter } from './adapters/index.js';

const tool = (name, description, properties = {}, required = []) => ({
  name: `deske2e_${name}`, description,
  inputSchema: { type: 'object', properties, required, additionalProperties: false },
});
const string = { type: 'string' };
const tools = [
  tool('launch', 'Launch an Electron or Tauri app from an existing DeskE2E config. Starts a fresh desktop session.', { config: { ...string, description: 'Path to deske2e.config.json' } }, ['config']),
  tool('snapshot', 'Read the visible text and labeled UI controls from the current desktop window.'),
  tool('click', 'Click a CSS selector in the current desktop window and record the action.', { selector: string }, ['selector']),
  tool('fill', 'Fill a field selected by CSS or testid and record the action.', { selector: string, text: string }, ['selector', 'text']),
  tool('assert_value', 'Assert the exact value of a text input.', { selector: string, text: string }, ['selector', 'text']),
  tool('press', 'Press a keyboard key/shortcut and record the action.', { key: string }, ['key']),
  tool('assert_text', 'Assert that selected UI text contains a substring and record the assertion.', { selector: string, text: string }, ['selector', 'text']),
  tool('select_window', 'Select a desktop window by zero-based index.', { index: { type: 'integer', minimum: 0 } }, ['index']),
  tool('screenshot', 'Capture a screenshot into the local artifacts folder, returning its absolute path.', { name: { ...string, description: 'Screenshot filename label (not a path)' } }),
  tool('save_test', 'Write recorded clicks, fills and assertions as a reproducible DeskE2E scenario. Never overwrites an existing file.', { path: { ...string, description: 'Destination JSON file path' }, name: { ...string, description: 'Name of the recorded scenario' } }, ['path', 'name']),
  tool('close', 'Close the current desktop session.'),
];

export async function serve({ input = process.stdin, output = process.stdout, adapterFactory = makeAdapter } = {}) {
  let driver = null;
  let config = null;
  let recorded = [];
  let screenshotIndex = 0;
  function checkedArgs(name, args) {
    const spec = tools.find(t => t.name === name);
    if (!spec || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid tool arguments');
    for (const key of Object.keys(args)) {
      const type = spec.inputSchema.properties[key];
      if (!type) throw new Error(`Unknown argument: ${key}`);
      if (typeof args[key] !== (type.type === 'integer' ? 'number' : type.type)) throw new Error(`Invalid ${key} type`);
      if (type.type === 'integer' && (!Number.isInteger(args[key]) || args[key] < 0 || args[key] > 99)) throw new Error(`Invalid ${key}`);
      if (type.type === 'string' && (args[key].length > 10000 || (!args[key] && key !== 'text'))) throw new Error(`Invalid ${key}`);
    }
    for (const key of spec.inputSchema.required) if (!(key in args)) throw new Error(`Missing argument: ${key}`);
    if (typeof args.selector === 'string') parseSelector(args.selector);
    return args;
  }
  const send = (payload) => output.write(JSON.stringify({ jsonrpc: '2.0', ...payload }) + '\n');
  async function close() { if (driver) { await driver.close(); driver = null; } }
  async function call(name, args = {}) {
    args = checkedArgs(name, args);
    if (name === 'deske2e_launch') {
      await close();
      config = await loadConfig(args.config);
      driver = await adapterFactory(config);
      recorded = []; screenshotIndex = 0;
      return `Started ${config.framework}: ${config.app.executablePath}`;
    }
    if (!driver) throw new Error('Start with deske2e_launch first');
    if (name === 'deske2e_snapshot') return JSON.stringify(await driver.snapshot(), null, 2);
    if (name === 'deske2e_click') { await driver.click(args.selector, 10000); recorded.push({ action: 'click', selector: args.selector }); return 'Clicked'; }
    if (name === 'deske2e_fill') { await driver.fill(args.selector, args.text, 10000); recorded.push({ action: 'fill', selector: args.selector, text: args.text }); return 'Filled'; }
    if (name === 'deske2e_press') { await driver.press(args.key); recorded.push({ action: 'press', key: args.key }); return 'Pressed'; }
    if (name === 'deske2e_assert_value') {
      const actual = await driver.value(args.selector, 10000);
      if (actual !== args.text) throw new Error(`Input value differs at ${JSON.stringify(args.selector)}`);
      recorded.push({ action: 'expectValue', selector: args.selector, text: args.text });
      return 'Value assertion passed';
    }
    if (name === 'deske2e_assert_text') {
      const actual = await driver.text(args.selector, 10000);
      if (!actual.includes(args.text)) throw new Error(`Expected ${JSON.stringify(args.text)}, got ${JSON.stringify(actual)}`);
      recorded.push({ action: 'expectText', selector: args.selector, text: args.text });
      return 'Assertion passed';
    }
    if (name === 'deske2e_select_window') { await driver.selectWindow(args.index); recorded.push({ action: 'selectWindow', index: args.index }); return 'Window selected'; }
    if (name === 'deske2e_screenshot') {
      const label = (args.name ?? 'capture').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
      const dest = path.resolve('deske2e-results', 'agent', `${++screenshotIndex}-${label || 'capture'}.png`);
      await mkdir(path.dirname(dest), { recursive: true });
      await driver.screenshot(dest);
      return dest;
    }
    if (name === 'deske2e_save_test') {
      if (!recorded.length) throw new Error('No recorded actions yet');
      const scenario = { version: 1, framework: config.framework, app: config.app,
        scenarios: [{ name: args.name, steps: recorded }] };
      // Validate generated test before writing it to disk.
      validateConfig(scenario);
      const target = path.resolve(path.dirname(config.configPath), args.path);
      const rel = path.relative(path.dirname(config.configPath), target);
      if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) throw new Error('Saved tests must stay inside the project directory');
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify(scenario, null, 2) + '\n', { flag: 'wx' });
      return `Saved ${recorded.length} steps: ${target}`;
    }
    if (name === 'deske2e_close') { await close(); return 'Closed'; }
    throw new Error(`Unknown tool: ${name}`);
  }
  async function dispatch(m) {
    if (m.method === 'notifications/initialized' || m.method?.startsWith('notifications/')) return;
    if (m.id === undefined) return;
    if (m.method === 'initialize') return send({ id: m.id, result: {
      protocolVersion: m.params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'deske2e', version: '0.2.0' },
    } });
    if (m.method === 'ping') return send({ id: m.id, result: {} });
    if (m.method === 'tools/list') return send({ id: m.id, result: { tools } });
    if (m.method === 'tools/call') {
      try {
        if (!tools.some(t => t.name === m.params?.name)) throw new Error('Unknown tool');
        const result = await call(m.params.name, m.params.arguments ?? {});
        return send({ id: m.id, result: { content: [{ type: 'text', text: result }] } });
      } catch (error) {
        return send({ id: m.id, result: { isError: true, content: [{ type: 'text', text: String(error.message ?? error) }] } });
      }
    }
    send({ id: m.id, error: { code: -32601, message: 'Method not found' } });
  }
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try { await dispatch(JSON.parse(line)); }
      catch (e) { send({ id: null, error: { code: -32700, message: 'Parse error' } }); }
    }
  } finally { await close(); }
}
