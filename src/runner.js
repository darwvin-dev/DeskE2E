import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { makeAdapter } from './adapters/index.js';
import { writeReport } from './report.js';

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 45) || 'test';
const timestamp = () => new Date().toISOString();
const messageOf = (error) => error instanceof Error ? error.message : String(error);

export async function executeStep(driver, step, artifactDir, prefix) {
  const timeout = step.timeoutMs ?? 10000;
  switch (step.action) {
    case 'click': return driver.click(step.selector, timeout);
    case 'fill': return driver.fill(step.selector, step.text, timeout);
    case 'expectText': {
      const actual = await driver.text(step.selector, timeout);
      if (!actual.includes(step.text)) throw new Error(`Expected ${JSON.stringify(step.selector)} to contain ${JSON.stringify(step.text)}; received ${JSON.stringify(actual.slice(0, 300))}`);
      return;
    }
    case 'expectVisible': return driver.expectVisible(step.selector, true, timeout);
    case 'expectHidden': return driver.expectVisible(step.selector, false, timeout);
    case 'wait': return new Promise((resolve) => setTimeout(resolve, step.ms));
    case 'selectWindow': return driver.selectWindow(step.index);
    case 'screenshot': {
      const filename = `${prefix}-${slug(step.name ?? 'screenshot')}.png`;
      await driver.screenshot(path.join(artifactDir, filename));
      return filename;
    }
    default: throw new Error(`Unimplemented action: ${step.action}`);
  }
}

export async function runSuite(config, { outputDir = 'deske2e-results', adapterFactory = makeAdapter, onProgress = () => {} } = {}) {
  const startedAt = timestamp();
  const absoluteOutput = path.resolve(outputDir);
  const artifacts = path.join(absoluteOutput, 'artifacts');
  await mkdir(artifacts, { recursive: true });
  const results = [];
  for (const [i, scenario] of config.scenarios.entries()) {
    const result = { name: scenario.name, status: 'passed', steps: [], startedAt: timestamp() };
    results.push(result);
    let adapter;
    try {
      adapter = await adapterFactory(config);
      for (const [j, step] of scenario.steps.entries()) {
        const item = { action: step.action, selector: step.selector ?? null, status: 'passed' };
        result.steps.push(item);
        const prefix = `${i + 1}-${slug(scenario.name)}-${j + 1}`;
        try {
          const artifact = await executeStep(adapter, step, artifacts, prefix);
          if (artifact) item.artifact = `artifacts/${artifact}`;
          onProgress(`  ✓ ${step.action}${step.selector ? ` ${step.selector}` : ''}`);
        } catch (error) {
          result.status = 'failed';
          item.status = 'failed';
          item.error = messageOf(error);
          result.error = item.error;
          onProgress(`  ✗ ${item.error}`);
          try {
            const filename = `${prefix}-failure.png`;
            await adapter.screenshot(path.join(artifacts, filename));
            result.failureScreenshot = `artifacts/${filename}`;
          } catch (captureError) {
            result.captureError = messageOf(captureError);
          }
          break;
        }
      }
    } catch (error) {
      result.status = 'failed';
      result.error = `Unable to start app: ${messageOf(error)}`;
      onProgress(`  ✗ ${result.error}`);
    } finally {
      if (adapter) {
        try { await adapter.close(); }
        catch (error) {
          result.status = 'failed';
          result.cleanupError = messageOf(error);
        }
      }
      result.finishedAt = timestamp();
    }
  }
  const report = {
    schemaVersion: 1, framework: config.framework, startedAt, finishedAt: timestamp(),
    summary: { passed: results.filter((r) => r.status === 'passed').length, failed: results.filter((r) => r.status === 'failed').length },
    scenarios: results,
  };
  await writeReport(absoluteOutput, report);
  return { report, outputDir: absoluteOutput };
}
