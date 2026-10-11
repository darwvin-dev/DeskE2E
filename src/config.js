import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseSelector } from './selector.js';

const actions = new Set(['click','fill','expectText','expectVisible','expectHidden','expectValue','press','wait','screenshot','selectWindow']);
const frameworks = new Set(['electron','tauri']);
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
const fail = (p, msg) => { throw new Error(`${p}: ${msg}`); };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const numberIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
function knownKeys(obj, allowed, at) {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) fail(`${at}.${key}`, 'unknown property');
}
function requiredString(v, at, max = 2048) { if (!nonempty(v) || v.length > max) fail(at, `must be a non-empty string up to ${max} characters`); }

export function validateConfig(raw) {
  if (!isObj(raw)) fail('config', 'expected an object');
  knownKeys(raw, ['version','framework','app','scenarios'], 'config');
  if (raw.version !== 1) fail('version', 'must be 1');
  if (!frameworks.has(raw.framework)) fail('framework', 'must be electron or tauri');
  if (!isObj(raw.app)) fail('app', 'expected object');
  knownKeys(raw.app, ['executablePath','args','cwd','timeoutMs','driverProvider'], 'app');
  requiredString(raw.app.executablePath, 'app.executablePath');
  if (raw.app.args !== undefined && (!Array.isArray(raw.app.args) || raw.app.args.length > 40 || !raw.app.args.every(v => typeof v === 'string' && v.length <= 4096))) fail('app.args','expected at most 40 strings');
  if (raw.app.cwd !== undefined) requiredString(raw.app.cwd,'app.cwd');
  if (raw.app.timeoutMs !== undefined && !numberIn(raw.app.timeoutMs, 100, 120000)) fail('app.timeoutMs','must be 100..120000');
  if (raw.app.driverProvider !== undefined && (!['embedded','external','crabnebula'].includes(raw.app.driverProvider) || raw.framework !== 'tauri')) fail('app.driverProvider', 'expected tauri embedded, external or crabnebula');
  if (!Array.isArray(raw.scenarios) || raw.scenarios.length === 0 || raw.scenarios.length > 200) fail('scenarios', 'expected 1..200 scenarios');
  const names = new Set();
  raw.scenarios.forEach((s, i) => {
    const at = `scenarios[${i}]`;
    if (!isObj(s)) fail(at, 'expected object');
    knownKeys(s, ['name','steps'], at);
    requiredString(s.name, `${at}.name`, 200);
    if (names.has(s.name)) fail(`${at}.name`, 'duplicate scenario name');
    names.add(s.name);
    if (!Array.isArray(s.steps) || s.steps.length === 0 || s.steps.length > 500) fail(`${at}.steps`, 'expected 1..500 steps');
    s.steps.forEach((step, j) => {
      const where = `${at}.steps[${j}]`;
      if (!isObj(step) || !actions.has(step.action)) fail(where, `unknown action; expected ${[...actions].join(', ')}`);
      knownKeys(step, ['action','selector','text','ms','index','name','timeoutMs','key'], where);
      if (['click','fill','expectText','expectValue','expectVisible','expectHidden'].includes(step.action)) {
        try { parseSelector(step.selector); } catch (e) { fail(`${where}.selector`, e.message); }
      }
      if (['fill','expectText','expectValue'].includes(step.action) && (typeof step.text !== 'string' || step.text.length > 10000)) fail(`${where}.text`, 'required string up to 10000 characters');
      if (step.action === 'wait' && !numberIn(step.ms, 0, 30000)) fail(`${where}.ms`, 'must be integer between 0 and 30000');
      if (step.action === 'press' && (!nonempty(step.key) || step.key.length > 80 || !/^[a-zA-Z0-9+ -]+$/.test(step.key))) fail(`${where}.key`, 'must be a keyboard shortcut');
      if (step.action === 'selectWindow' && !numberIn(step.index, 0, 99)) fail(`${where}.index`, 'must be between 0 and 99');
      if (step.action === 'screenshot' && step.name !== undefined) requiredString(step.name, `${where}.name`, 80);
      if (step.timeoutMs !== undefined && !numberIn(step.timeoutMs, 1, 120000)) fail(`${where}.timeoutMs`, 'must be 1..120000');
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
      ...(config.app.cwd ? { cwd: path.resolve(base, config.app.cwd) } : { cwd: base }),
    },
    configPath: absolute,
  };
}
