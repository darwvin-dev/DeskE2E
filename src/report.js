import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const escapeHTML = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const esc = escapeHTML;
const screenshot = (url) => url && /^artifacts\/[a-z0-9_-]+\.png$/i.test(url)
  ? `<a href="${esc(url)}"><img src="${esc(url)}" alt="Failure screenshot" loading="lazy" /></a>` : '';

export function renderHTML(report) {
  const scenarios = report.scenarios.map((s) => `<section class="card">
    <h2><span class="${s.status}">${esc(s.status.toUpperCase())}</span> ${esc(s.name)}</h2>
    ${s.error ? `<p class="error">${esc(s.error)}</p>` : ''}
    ${s.cleanupError ? `<p class="error">Cleanup: ${esc(s.cleanupError)}</p>` : ''}
    <ol>${s.steps.map(step => `<li class="${step.status}">${esc(step.action)}${step.selector ? ` <code>${esc(step.selector)}</code>` : ''}${step.error ? ` — ${esc(step.error)}` : ''}${step.artifact ? ` <a href="${esc(step.artifact)}">screenshot</a>` : ''}</li>`).join('')}</ol>
    ${screenshot(s.failureScreenshot)}
  </section>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeskE2E Test Report</title>
  <style>:root{color-scheme:dark}body{font:15px/1.6 system-ui,sans-serif;background:#0b1220;color:#e2e8f0;margin:0;padding:36px;max-width:1000px;margin-inline:auto}h1{font-size:2rem;letter-spacing:-.04em}h2{font-size:1.1rem}p{color:#94a3b8}.card{border:1px solid #334155;background:#111c30;border-radius:12px;padding:22px;margin:18px 0}.passed{color:#4ade80}.failed,.error{color:#fb7185}code{background:#1e293b;padding:3px 6px;border-radius:4px}a{color:#93c5fd}li{margin:5px 0}img{max-width:100%;margin-top:16px;border-radius:8px;border:1px solid #334155}header{display:flex;gap:20px;align-items:center;flex-wrap:wrap}small{color:#94a3b8}</style></head><body><header><div><h1>DeskE2E</h1><small>Desktop end-to-end test report · ${esc(report.framework)}</small></div><div><strong class="passed">${report.summary.passed} passed</strong> · <strong class="failed">${report.summary.failed} failed</strong></div></header><p>Started ${esc(report.startedAt)} · Finished ${esc(report.finishedAt)}</p>${scenarios}</body></html>`;
}

export async function writeReport(dir, report) {
  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n'),
    writeFile(path.join(dir, 'report.html'), renderHTML(report)),
  ]);
}
