import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, loadConfig } from '../src/config.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const config = () => ({ version: 1, framework: 'electron', app: { executablePath: './electron', args: ['.'] }, scenarios: [{ name: 'one', steps: [{action: 'expectText', selector: '#a', text: 'ok'}] }] });
test('validates a runnable scenario', () => assert.equal(validateConfig(config()).framework, 'electron'));
test('rejects unknown actions', () => { const c = config(); c.scenarios[0].steps[0].action = 'executeJavascript'; assert.throws(() => validateConfig(c), /unknown action/); });
test('rejects invalid wait and missing selectors', () => {
 const c = config(); c.scenarios[0].steps[0] = { action: 'wait', ms: -1 }; assert.throws(() => validateConfig(c), /must be integer/);
 c.scenarios[0].steps[0] = {action: 'click'}; assert.throws(() => validateConfig(c), /selector/);
});
test('resolves executable and cwd from config file directory', async () => {
 const tmp = await mkdtemp(path.join(os.tmpdir(), 'deske2e-'));
 try { const c = config(); c.app.cwd = '.'; await writeFile(path.join(tmp, 'config.json'), JSON.stringify(c)); const result = await loadConfig(path.join(tmp, 'config.json')); assert.equal(result.app.executablePath, path.join(tmp, 'electron')); assert.equal(result.app.cwd, tmp); }
 finally { await rm(tmp, { recursive: true, force: true }); }
});
