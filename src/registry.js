/**
 * Simple shared state registry.
 *
 * Keys are strings using dot notation for nested structures.
 * Observers can subscribe to changes on specific keys. When a key is set,
 * all observers for that key are invoked with the new value.
 */
export default class Registry {
  constructor() {
    /**
     * Internal storage for registry values.
     * @type {Record<string, any>}
     */
    this.store = {};
    /**
     * Observers keyed by registry key.
     * @type {Map<string, Set<Function>>}
     */
    this.observers = new Map();
  }

  /**
   * Retrieve a value from the registry.
   * Supports nested keys separated by dots.
   *
   * @param {string} key The key to retrieve.
   * @returns {any} The stored value or undefined.
   */
  get(key) {
    const parts = key.split('.');
    let obj = this.store;
    for (const part of parts) {
      if (obj && typeof obj === 'object' && part in obj) {
        obj = obj[part];
      } else {
        return undefined;
      }
    }
    return obj;
  }

  /**
   * Set a value in the registry.
   * Supports nested keys separated by dots. Intermediate objects are created as needed.
   * After setting the value, all observers for the key are notified.
   *
   * @param {string} key The key to set.
   * @param {any} value The value to assign.
   */
  set(key, value) {
    const parts = key.split('.');
    let obj = this.store;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in obj) || typeof obj[part] !== 'object') {
        obj[part] = {};
      }
      obj = obj[part];
    }
    obj[parts[parts.length - 1]] = value;
    // Notify observers
    this.notify(key, value);
  }

  /**
   * Observe changes to a registry key.
   * The callback is invoked whenever the key is set.
   *
   * @param {string} key The key to observe.
   * @param {(value: any) => void} cb Callback invoked with the new value.
   */
  observe(key, cb) {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set());
    }
    this.observers.get(key).add(cb);
    // Immediately invoke with current value if exists
    const current = this.get(key);
    if (current !== undefined) {
      cb(current);
    }
  }

  /**
   * Notify observers of a key change.
   *
   * @param {string} key The key whose observers should be notified.
   * @param {any} value The new value.
   */
  notify(key, value) {
    const obs = this.observers.get(key);
    if (!obs) return;
    [...obs].forEach((cb) => {
      try {
        cb(value);
      } catch (err) {
        console.error('Error in registry observer for', key, err);
      }
    });
  }
}