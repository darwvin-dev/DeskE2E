import test from 'node:test';
import assert from 'node:assert/strict';
import { ElectronAdapter } from '../src/adapters/electron.js';
import { TauriAdapter } from '../src/adapters/tauri.js';

test('electron testid selectors use Playwright getByTestId', async () => {
 const calls=[]; const handle={click: async x=>calls.push(x)};
 const adapter=new ElectronAdapter({});
 adapter.window={getByTestId:(v)=>{calls.push(v);return handle;},locator:()=>{throw Error('wrong locator')}};
 await adapter.click('testid:save',123);
 assert.deepEqual(calls,['save',{timeout:123}]);
});
test('Tauri uses safe CSS selector equivalent to testid', async () => {
 const adapter=new TauriAdapter({});
 const called=[];
 adapter.browser={$:(s)=>{called.push(s);return {waitForDisplayed:async()=>{},getValue:async()=> 'abc'}}};
 assert.equal(await adapter.value('testid:input',10),'abc');
 assert.deepEqual(called,['[data-testid="input"]']);
});
