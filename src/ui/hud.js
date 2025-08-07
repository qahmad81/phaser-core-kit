/**
 * Create a HUD (heads up display) UI primitive.
 * The HUD is a simple horizontal bar at the top of the container showing
 * key‑value pairs (e.g. money, energy). Values can be set entirely or patched.
 *
 * @param {HTMLElement} container Parent container to append HUD.
 * @returns {import("../types").HudAPI}
 */
export function createHud(container) {
  let hudEl = document.createElement('div');
  hudEl.className = 'pcore-hud';
  Object.assign(hudEl.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    display: 'flex',
    gap: '1rem',
    padding: '0.5rem',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    fontFamily: 'sans-serif',
    zIndex: 900,
    pointerEvents: 'none', // Allow clicks to pass through
  });
  container.appendChild(hudEl);
  /**
   * Internal state of hud values.
   * @type {Record<string, string|number>}
   */
  let state = {};
  /**
   * Render the HUD according to current state.
   */
  function render() {
    hudEl.innerHTML = '';
    Object.entries(state).forEach(([k, v]) => {
      const item = document.createElement('div');
      item.textContent = `${k}: ${v}`;
      hudEl.appendChild(item);
    });
  }
  function set(newStats) {
    state = { ...newStats };
    render();
  }
  function patch(delta) {
    state = { ...state, ...delta };
    render();
  }
  return { set, patch };
}