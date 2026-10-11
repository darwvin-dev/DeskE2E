// Portable, explicit selectors. Never inject an arbitrary expression into a renderer.
// CSS is kept for compatibility. testid: is preferred for durable CI tests.
export function parseSelector(selector) {
  if (typeof selector !== 'string' || !selector.trim() || selector.length > 2048) throw new Error('selector must be a non-empty string (max 2048 chars)');
  if (selector.startsWith('testid:')) {
    const value = selector.slice(7);
    if (!value || value.length > 128 || !/^[\w.:/-]+$/.test(value)) throw new Error('Invalid testid selector');
    return { kind: 'testid', value };
  }
  if (selector.startsWith('css:')) {
    if (!selector.slice(4).trim()) throw new Error('Empty CSS selector');
    return { kind: 'css', value: selector.slice(4) };
  }
  return { kind: 'css', value: selector };
}

export function cssSelector(selector) {
  const parsed = parseSelector(selector);
  if (parsed.kind === 'css') return parsed.value;
  // Escape attribute value to prevent selector injection.
  return `[data-testid="${parsed.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}
