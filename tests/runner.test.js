import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { runSuite } from '../src/runner.js';
import { escapeHTML, renderHTML } from '../src/report.js';

class FakeAdapter {
 constructor() { this.closed = false; }
 async click() {}
 async fill() {}
 async text() { return 'Hello DeskE2E'; }
 async expectVisible(_, visible) { if (!visible) throw new Error('still visible'); }
 async screenshot(destination) { await writeFile(destination, 'mock screenshot'); }
 async selectWindow() {}
 async close() { this.closed = true; }
}
test('runs steps and writes report with passing state', async () => {
 const dir = await mkdtemp(path.join(os.tmpdir(), 'deske2e-pass-'));
 const adapters = [];
 try {
  const { report } = await runSuite({framework: 'electron', scenarios: [{name:'welcome',steps:[{action:'expectText',selector:'body',text:'DeskE2E'},{action:'screenshot',name:'welcome'}]}]}, {outputDir:dir,adapterFactory:async()=>{const a=new FakeAdapter();adapters.push(a);return a;}});
  assert.deepEqual(report.summary,{passed:1,failed:0});
  assert.equal(adapters[0].closed,true);
  assert.match(await readFile(path.join(dir,'report.html'),'utf8'),/welcome/);
  assert.match(await readFile(path.join(dir,'artifacts','1-welcome-2-welcome.png'),'utf8'),/mock/);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('reports assertion failure, captures evidence, and continues to next scenario', async () => {
 const dir = await mkdtemp(path.join(os.tmpdir(), 'deske2e-fail-'));
 try {
  const { report } = await runSuite({framework:'electron',scenarios:[
   {name:'failure',steps:[{action:'expectText',selector:'body',text:'missing'}]},
   {name:'success',steps:[{action:'expectVisible',selector:'body'}]}
  ]}, {outputDir:dir,adapterFactory:async()=>new FakeAdapter()});
  assert.deepEqual(report.summary,{passed:1,failed:1});
  assert.match(report.scenarios[0].error,/Expected/);
  assert.match(report.scenarios[0].failureScreenshot,/\.png$/);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('escapes untrusted test output in HTML',()=>{
 assert.equal(escapeHTML('<script>"&'), '&lt;script&gt;&quot;&amp;');
 const html = renderHTML({framework:'electron',summary:{passed:0,failed:1},startedAt:'t',finishedAt:'t',scenarios:[{name:'<script>alert(1)</script>',status:'failed',error:'<img src=x>',steps:[]} ]});
 assert.doesNotMatch(html,/<script>alert\(1\)/);
 assert.match(html,/&lt;img src=x&gt;/);
});
test('runs expected input values and keyboard shortcuts', async () => {
 const dir = await mkdtemp(path.join(os.tmpdir(), 'deske2e-key-'));
 const presses = [];
 try {
  const { report }=await runSuite({framework:'electron',scenarios:[{name:'input',steps:[
   {action:'expectValue',selector:'testid:username',text:'alice'},
   {action:'press',key:'Control+A'}
  ]}]},{outputDir:dir,adapterFactory:async()=>({value:async()=> 'alice',press:async key=>presses.push(key),close:async()=>{}})});
  assert.equal(report.summary.passed,1);
  assert.deepEqual(presses,['Control+A']);
  assert.equal(report.scenarios[0].steps.length,2);
  assert.ok(report.scenarios[0].steps.every(x=>x.durationMs>=0));
 } finally { await rm(dir,{recursive:true,force:true}); }
});
