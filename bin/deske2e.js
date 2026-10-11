#!/usr/bin/env node
import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { runSuite } from '../src/runner.js';

const help = `DeskE2E — deterministic desktop E2E testing for Electron and Tauri

Usage:
  deske2e init --framework electron|tauri [--app PATH] [--config FILE]
  deske2e doctor [--config FILE]
  deske2e run [--config FILE] [--output DIR]
  deske2e mcp

Run [1mdeske2e init[0m to create an editable scenario configuration.
Agent integration: add "command": "deske2e", "args": ["mcp"] to an MCP-capable coding agent.
`;

function getOpt(args, name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx < 0) return fallback;
  if (!args[idx + 1] || args[idx + 1].startsWith('--')) throw new Error(`--${name} requires a value`);
  return args[idx + 1];
}

export async function main(args = process.argv.slice(2)) {
  const [command] = args;
  if (!command || command === 'help' || args.includes('--help')) { process.stdout.write(help); return 0; }
  if (command === 'mcp') { await import('../src/mcp.js').then(m => m.serve()); return 0; }
  const configPath = path.resolve(getOpt(args, 'config', 'deske2e.config.json'));
  if (command === 'init') {
    const framework = getOpt(args, 'framework', 'electron');
    if (!['tauri', 'electron'].includes(framework)) throw new Error('--framework must be electron or tauri');
    const app = getOpt(args, 'app', framework === 'tauri' ? './src-tauri/target/release/my-app' : './node_modules/.bin/electron');
    const example = {
      version: 1, framework, app: { executablePath: app, args: framework === 'electron' ? ['.'] : [], cwd: '.' },
      scenarios: [{ name: 'App starts and displays its main window', steps: [
        { action: 'expectVisible', selector: 'body' }, { action: 'screenshot', name: 'first-window' }
      ] }],
    };
    try { await access(configPath); throw new Error(`Configuration already exists: ${configPath}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(configPath, JSON.stringify(example, null, 2) + '\n', { flag: 'wx' });
    console.log(`Created ${configPath}. Update the app path, then run: deske2e run`);
    return 0;
  }
  if (command === 'doctor') {
    const config = await loadConfig(configPath);
    try { await access(config.app.executablePath); }
    catch { throw new Error(`App executable not found: ${config.app.executablePath}`); }
    console.log(`✓ Valid ${config.framework} configuration`);
    console.log(`✓ App exists: ${config.app.executablePath}`);
    console.log(`✓ ${config.scenarios.length} scenario(s)`);
    console.log('Note: driver prerequisites and a graphical desktop session are validated only at runtime.');
    return 0;
  }
  if (command === 'run') {
    const config = await loadConfig(configPath);
    const outputDir = getOpt(args, 'output', 'deske2e-results');
    const { report, outputDir: actualDir } = await runSuite(config, { outputDir,
      onProgress: (message) => console.log(message) });
    console.log(`${report.summary.passed} passed · ${report.summary.failed} failed — ${actualDir}/report.html`);
    return report.summary.failed ? 1 : 0;
  }
  throw new Error(`Unknown command: ${command}\n\n${help}`);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(err => {
    console.error(`DeskE2E: ${err.message}`);
    process.exitCode = 2;
  });
}
