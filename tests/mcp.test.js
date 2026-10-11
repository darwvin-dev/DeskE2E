import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { serve } from '../src/mcp.js';

async function messages(requests, adapterFactory=()=>{throw Error('not expected');}) {
 const input = new PassThrough(); const output = new PassThrough(); let data='';
 output.on('data',d=>data+=d.toString());
 const pending=serve({input,output,adapterFactory});
 for(const msg of requests) input.write(JSON.stringify({jsonrpc:'2.0',...msg})+'\n');
 input.end(); await pending;
 return data.trim().split('\n').map(JSON.parse);
}
test('MCP handshake and discovery', async()=> {
 const [init,list]=await messages([{id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},{id:2,method:'tools/list'}]);
 assert.equal(init.result.serverInfo.name,'deske2e');
 assert.ok(list.result.tools.some(t=>t.name==='deske2e_assert_value'));
 assert.ok(list.result.tools.some(t=>t.name==='deske2e_press'));
});
test('MCP rejects missing or unknown tool arguments before launch', async()=> {
 const [missing,extra]=await messages([
  {id:1,method:'tools/call',params:{name:'deske2e_launch',arguments:{}}},
  {id:2,method:'tools/call',params:{name:'deske2e_launch',arguments:{config:'x.json',execute:true}}}
 ]);
 assert.equal(missing.result.isError,true);
 assert.match(missing.result.content[0].text,/Missing argument/);
 assert.match(extra.result.content[0].text,/Unknown argument/);
});
