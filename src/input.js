/**
 * Setup custom input handling based on a provided mapping. The mapping can
 * either be flat (action → key) or nested (category → {action: key}). Keys
 * are compared case‑insensitively. When a mapped key is pressed the
 * corresponding action name is emitted on the event bus under the event
 * `input` with payload `{ action }`.
 *
 * @param {Record<string, any>} mapping The input mapping definition.
 * @param {EventBus} bus The event bus to emit actions on.
 */
export function setupInput(mapping, bus) {
  const keyToAction = {};
  function flatten(prefix, obj) {
    Object.entries(obj).forEach(([k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        keyToAction[v.toLowerCase()] = key;
      } else if (typeof v === 'object') {
        flatten(key, v);
      }
    });
  }
  flatten('', mapping || {});
  function handler(e) {
    const key = e.key.toLowerCase();
    if (keyToAction[key]) {
      bus.emit('input', { action: keyToAction[key] });
    }
  }
  window.addEventListener('keydown', handler);
  // Return a function to remove the handler
  return () => {
    window.removeEventListener('keydown', handler);
  };
}