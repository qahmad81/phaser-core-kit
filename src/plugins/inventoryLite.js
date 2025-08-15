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
    function renderStorage(opts = {}) {
      if (typeof document === 'undefined') return;
      const position = opts.position || 'right';
      const collapsed = opts.collapsed ?? false;
      const charId = opts.charId ?? 'hero';
      const container = core.app?.canvas?.parentElement || document.body;
      const panel = document.createElement('div');
      panel.style.position = 'absolute';
      panel.style.background = 'rgba(0,0,0,0.7)';
      panel.style.color = '#fff';
      panel.style.padding = '4px';
      panel.style.minWidth = '120px';
      panel.style.maxHeight = '200px';
      panel.style.overflowY = 'auto';
      if (position === 'left') panel.style.left = '0';
      if (position === 'right') panel.style.right = '0';
      if (position === 'bottom') {
        panel.style.left = '0';
        panel.style.right = '0';
        panel.style.bottom = '0';
      } else {
        panel.style.top = '0';
      }
      const toggle = document.createElement('button');
      toggle.textContent = collapsed ? '▶' : '◀';
      toggle.style.position = 'absolute';
      toggle.style.top = '0';
      if (position === 'right') toggle.style.left = '-20px';
      if (position === 'left') toggle.style.right = '-20px';
      if (position === 'bottom') {
        toggle.style.right = '0';
        toggle.style.top = '-20px';
      }
      panel.appendChild(toggle);
      const listEl = document.createElement('div');
      panel.appendChild(listEl);
      function refresh() {
        listEl.innerHTML = '';
        const items = list(charId);
        items.forEach((it) => {
          const row = document.createElement('div');
          row.textContent = `${it.id} (${it.q})`;
          row.style.cursor = 'pointer';
          row.onclick = () => {
            const menu = document.createElement('div');
            menu.style.background = '#222';
            menu.style.padding = '2px';
            const consume = document.createElement('div');
            consume.textContent = 'consume';
            consume.onclick = () => {
              bus.emit('inventory:consume', { id: it.id });
              menu.remove();
            };
            const drop = document.createElement('div');
            drop.textContent = 'drop';
            drop.onclick = () => {
              bus.emit('inventory:drop', { id: it.id });
              menu.remove();
            };
            menu.appendChild(consume);
            menu.appendChild(drop);
            row.appendChild(menu);
          };
          listEl.appendChild(row);
        });
      }
      toggle.onclick = () => {
        const hidden = listEl.style.display === 'none';
        listEl.style.display = hidden ? 'block' : 'none';
      };
      listEl.style.display = collapsed ? 'none' : 'block';
      container.appendChild(panel);
      refresh();
      bus.on('inventory:changed', refresh);
    }
    core.inventory = { add, remove, has, list, renderStorage };
  },
};