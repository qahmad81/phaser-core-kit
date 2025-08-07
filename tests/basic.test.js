import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from '../src/index.js';
import { DialogueLite } from '../src/plugins/dialogueLite.js';
import { InventoryLite } from '../src/plugins/inventoryLite.js';
import { TradeLite } from '../src/plugins/tradeLite.js';
import { CharactersLite } from '../src/plugins/charactersLite.js';

// Set up a mock localStorage for Node environment
const mockStorage = (() => {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

// Apply mock storage before each test
beforeEach(() => {
  global.localStorage = mockStorage;
  mockStorage.clear();
});

describe('Core Kit Basics', () => {
  it('EventBus can subscribe and emit', () => {
    const core = createCore({});
    let payload = null;
    core.bus.on('test:event', (p) => {
      payload = p;
    });
    core.bus.emit('test:event', { a: 1 });
    expect(payload).toEqual({ a: 1 });
  });

  it('Registry get/set/observe works', () => {
    const core = createCore({});
    let observed;
    core.registry.observe('foo.bar', (v) => {
      observed = v;
    });
    core.registry.set('foo.bar', 42);
    expect(core.registry.get('foo.bar')).toBe(42);
    expect(observed).toBe(42);
  });

  it('loadConfig emits event and sets seed', async () => {
    const core = createCore({});
    let loaded = false;
    core.bus.on('core:config_loaded', () => {
      loaded = true;
    });
    const cfg = {
      schemaVersion: '1.0',
      game: { title: 'Demo', seed: 7, startScene: 'a' },
      display: { width: 10, height: 10, backgroundColor: 0 },
      assets: [],
      scenes: [{ id: 'a' }],
    };
    await core.loadConfig(cfg);
    // After load, our RNG should use seed 7 deterministically
    const first = core.rng();
    // Reset seed again to 7 and confirm same first value
    core.setSeed(7);
    const second = core.rng();
    expect(first).toBe(second);
    expect(loaded).toBe(true);
  });

  it('Inventory plugin can add and remove items', async () => {
    const core = createCore({});
    InventoryLite.init(core);
    CharactersLite.init(core);
    await core.loadConfig({
      schemaVersion: '1.0',
      game: { title: 'Inv', startScene: 's' },
      assets: [],
      scenes: [{ id: 's' }],
      inventory: { shared: [], byCharacter: { hero: [] } },
      characters: [{ id: 'hero', name: 'Tony', sprite: 'player', money: 100, energy: 80 }],
    });
    core.inventory.add('apple', 2);
    expect(core.inventory.has('apple', 2)).toBe(true);
    core.inventory.remove('apple', 1);
    expect(core.inventory.list().find((i) => i.id === 'apple').q).toBe(1);
  });

  it('Trade plugin processes purchases and updates inventory/money', async () => {
    const core = createCore({});
    InventoryLite.init(core);
    CharactersLite.init(core);
    TradeLite.init(core);
    await core.loadConfig({
      schemaVersion: '1.0',
      game: { title: 'Trade', startScene: 's' },
      assets: [],
      scenes: [{ id: 's' }],
      inventory: { shared: [], byCharacter: { hero: [] } },
      characters: [{ id: 'hero', name: 'Tony', sprite: 'player', money: 20, energy: 80 }],
    });
    const result = core.trade.buy('apple', 10, 1);
    expect(result).toBe(true);
    // Money should decrease by 10
    expect(core.characters.getMoney('hero')).toBe(10);
    // Item should appear in inventory for hero
    expect(core.inventory.has('apple', 1, 'hero')).toBe(true);
    // Attempt to buy again should fail due to insufficient funds
    expect(core.trade.buy('banana', 12, 1)).toBe(false);
  });

  it('save and load round‑trips registry state', async () => {
    const core = createCore({});
    CharactersLite.init(core);
    await core.loadConfig({
      schemaVersion: '1.0',
      game: { title: 'Save', startScene: 's' },
      assets: [],
      scenes: [{ id: 's' }],
      characters: [{ id: 'hero', name: 'Tony', sprite: 'player', money: 50, energy: 80 }],
    });
    core.characters.addMoney('hero', 50);
    await core.save('test');
    // Create new core to load the saved state
    const core2 = createCore({});
    CharactersLite.init(core2);
    await core2.loadConfig({
      schemaVersion: '1.0',
      game: { title: 'Save', startScene: 's' },
      assets: [],
      scenes: [{ id: 's' }],
      characters: [{ id: 'hero', name: 'Tony', sprite: 'player', money: 0, energy: 0 }],
    });
    await core2.load('test');
    expect(core2.registry.get('char.hero.money')).toBe(100);
  });
});