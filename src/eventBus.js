/**
 * Simple EventBus implementation.
 * Allows registering, unregistering, and emitting events with payloads.
 *
 * The bus stores handlers in a Map keyed by event name.
 * Handlers are invoked synchronously when an event is emitted.
 */
export default class EventBus {
  constructor() {
    /**
     * @type {Map<string, Set<Function>>}
     */
    this.events = new Map();
  }

  /**
   * Subscribe a handler to an event name.
   *
   * @param {string} evt The event name.
   * @param {Function} handler The handler to invoke when the event is emitted.
   */
  on(evt, handler) {
    if (!this.events.has(evt)) {
      this.events.set(evt, new Set());
    }
    this.events.get(evt).add(handler);
  }

  /**
   * Unsubscribe a handler from an event name.
   *
   * @param {string} evt The event name.
   * @param {Function} handler The handler to remove.
   */
  off(evt, handler) {
    if (!this.events.has(evt)) return;
    this.events.get(evt).delete(handler);
  }

  /**
   * Emit an event with an optional payload.
   * All registered handlers for the event will be invoked synchronously.
   *
   * @param {string} evt The event name.
   * @param {any} payload Optional payload passed to handlers.
   */
  emit(evt, payload) {
    const handlers = this.events.get(evt);
    if (!handlers) return;
    // Copy handlers to avoid issues if handlers modify the set while iterating.
    [...handlers].forEach((h) => {
      try {
        h(payload);
      } catch (err) {
        console.error('Error in event handler for', evt, err);
      }
    });
  }
}