import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { serve } from '../src/mcp.js';

test('MCP handshake and tool discovery work over newline JSON-RPC', async () => {
 const input = new PassThrough(); const output = new PassThrough(); let text = '';
 output.on('data', d=>{ text += d.toString(); });
 const serving = serve({input,output,adapterFactory:()=>{throw new Error('not expected');}});
 input.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})+'\n');
 input.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n');
 input.end(); await serving;
 const [init,list] = text.trim().split('\n').map(JSON.parse);
 assert.equal(init.result.serverInfo.name,'deske2e');
 assert.ok(list.result.tools.some(t=>t.name==='deske2e_snapshot'));
});
