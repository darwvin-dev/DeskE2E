import { readFile } from 'node:fs/promises';
import path from 'node:path';

const actions = new Set(['click', 'fill', 'expectText', 'expectVisible', 'expectHidden', 'wait', 'screenshot', 'selectWindow']);
const frameworks = new Set(['electron', 'tauri']);
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
const fail = (p, msg) => { throw new Error(`${p}: ${msg}`); };

export function validateConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('config', 'expected an object');
  if (raw.version !== 1) fail('version', 'must be 1');
  if (!frameworks.has(raw.framework)) fail('framework', 'must be electron or tauri');
  if (!raw.app || !nonempty(raw.app.executablePath)) fail('app.executablePath', 'required');
  if (raw.app.args !== undefined && (!Array.isArray(raw.app.args) || !raw.app.args.every((v) => typeof v === 'string'))) fail('app.args', 'expected string array');
  if (raw.app.cwd !== undefined && !nonempty(raw.app.cwd)) fail('app.cwd', 'must be a string');
  if (!Array.isArray(raw.scenarios) || raw.scenarios.length === 0) fail('scenarios', 'at least one scenario is required');
  raw.scenarios.forEach((s, i) => {
    if (!nonempty(s.name)) fail(`scenarios[${i}].name`, 'required');
    if (!Array.isArray(s.steps) || s.steps.length === 0) fail(`scenarios[${i}].steps`, 'at least one step is required');
    s.steps.forEach((step, j) => {
      const at = `scenarios[${i}].steps[${j}]`;
      if (!step || !actions.has(step.action)) fail(at, `unknown action; expected ${[...actions].join(', ')}`);
      if (['click', 'fill', 'expectText', 'expectVisible', 'expectHidden'].includes(step.action) && !nonempty(step.selector)) fail(`${at}.selector`, 'required');
      if (['fill', 'expectText'].includes(step.action) && typeof step.text !== 'string') fail(`${at}.text`, 'required string');
      if (step.action === 'wait' && (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 30000)) fail(`${at}.ms`, 'must be integer between 0 and 30000');
      if (step.action === 'selectWindow' && (!Number.isInteger(step.index) || step.index < 0)) fail(`${at}.index`, 'must be a nonnegative integer');
      if (step.timeoutMs !== undefined && (!Number.isInteger(step.timeoutMs) || step.timeoutMs < 1 || step.timeoutMs > 120000)) fail(`${at}.timeoutMs`, 'must be between 1 and 120000');
    });
  });
  return raw;
}

export async function loadConfig(configPath) {
  const absolute = path.resolve(configPath);
  const raw = JSON.parse(await readFile(absolute, 'utf8'));
  const config = validateConfig(raw);
  const base = path.dirname(absolute);
  return {
    ...config,
    app: {
      ...config.app,
      executablePath: path.resolve(base, config.app.executablePath),
      ...(config.app.cwd ? {cwd: path.resolve(base, config.app.cwd)} : {}),
    },
    configPath: absolute,
  };
}
