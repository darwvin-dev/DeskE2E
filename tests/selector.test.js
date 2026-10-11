import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSelector, cssSelector } from '../src/selector.js';

test('accepts explicit testids and CSS selectors', () => {
  assert.deepEqual(parseSelector('testid:save-button'), {kind:'testid',value:'save-button'});
  assert.equal(cssSelector('testid:save-button'), '[data-testid="save-button"]');
  assert.equal(cssSelector('css:main button'), 'main button');
  assert.equal(cssSelector('button'), 'button');
});
test('rejects empty testids and CSS injection-like values', () => {
  assert.throws(()=>parseSelector('testid:'),/Invalid/);
  assert.throws(()=>parseSelector('testid:x"] ~ *'),/Invalid/);
  assert.throws(()=>parseSelector('css:'),/Empty/);
});
