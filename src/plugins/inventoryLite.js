/**
 * InventoryLite plugin.
 * Provides a simple inventory where items are identified by id and stored with
 * quantities. No rarity or quality are tracked. Supports shared inventory and
 * per‑character inventories.
 */
export const InventoryLite = {
  /**
   * Initialise the inventory plugin.
   *
   * @param {import('../types').Core} core
   */
  init(core) {
    const bus = core.bus;
    const registry = core.registry;
    // Load initial inventory from config when config loaded
    bus.on('core:config_loaded', (cfg) => {
      // Shared inventory
      if (cfg.inventory && Array.isArray(cfg.inventory.shared)) {
        registry.set('inventory.shared', cfg.inventory.shared.reduce((acc, item) => {
          acc[item.id] = (acc[item.id] || 0) + (item.q ?? 1);
          return acc;
        }, {}));
      } else {
        registry.set('inventory.shared', {});
      }
      // Per-character inventory
      if (cfg.inventory && cfg.inventory.byCharacter) {
        Object.entries(cfg.inventory.byCharacter).forEach(([charId, items]) => {
          const inv = {};
          items.forEach((item) => {
            inv[item.id] = (inv[item.id] || 0) + (item.q ?? 1);
          });
          registry.set(`inventory.byCharacter.${charId}`, inv);
        });
      }
    });
    function add(id, q = 1, charId) {
      if (!id) return;
      if (charId) {
        const path = `inventory.byCharacter.${charId}`;
        const inv = registry.get(path) || {};
        inv[id] = (inv[id] || 0) + q;
        registry.set(path, { ...inv });
      } else {
        const inv = registry.get('inventory.shared') || {};
        inv[id] = (inv[id] || 0) + q;
        registry.set('inventory.shared', { ...inv });
      }
      bus.emit('inventory:added', { id, q, charId });
      bus.emit('inventory:changed', {});
    }
    function remove(id, q = 1, charId) {
      if (!id) return;
      if (charId) {
        const path = `inventory.byCharacter.${charId}`;
        const inv = { ...(registry.get(path) || {}) };
        if (inv[id]) {
          inv[id] = Math.max(0, inv[id] - q);
          if (inv[id] === 0) delete inv[id];
          registry.set(path, inv);
          bus.emit('inventory:removed', { id, q, charId });
          bus.emit('inventory:changed', {});
        }
      } else {
        const inv = { ...(registry.get('inventory.shared') || {}) };
        if (inv[id]) {
          inv[id] = Math.max(0, inv[id] - q);
          if (inv[id] === 0) delete inv[id];
          registry.set('inventory.shared', inv);
          bus.emit('inventory:removed', { id, q });
          bus.emit('inventory:changed', {});
        }
      }
    }
    function has(id, q = 1, charId) {
      if (!id) return false;
      const inv = charId ? registry.get(`inventory.byCharacter.${charId}`) : registry.get('inventory.shared');
      return (inv?.[id] ?? 0) >= q;
    }
    function list(charId) {
      const inv = charId ? registry.get(`inventory.byCharacter.${charId}`) : registry.get('inventory.shared');
      return Object.entries(inv || {}).map(([id, qty]) => ({ id, q: qty }));
    }
    // Attach API to core
    core.inventory = { add, remove, has, list };
  },
};