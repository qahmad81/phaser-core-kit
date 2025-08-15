import EventBus from './eventBus.js';
import Registry from './registry.js';
import { createRng } from './rng.js';
import { createDialog } from './ui/dialog.js';
import { createHud } from './ui/hud.js';
import { createToast } from './ui/toast.js';
import { setupInput } from './input.js';
import { createConfigLoader } from './loader.js';

/**
 * Default core options.
 * @type {import('./types').CoreOptions}
 */
const DEFAULT_OPTS = {
  container: 'body',
  width: 800,
  height: 600,
  backgroundColor: 0x000000,
  seed: undefined,
  input: {},
};

/**
 * Create the core kit instance.
 *
 * This function sets up Phaser, the event bus, registry, RNG, input mapping,
 * configuration loader and UI primitives. After creation, you can call
 * `loadConfig()` with a configuration file and then `start()` to begin the game.
 *
 * @param {import('./types').CoreOptions} [opts]
 * @returns {import('./types').Core}
 */
export function createCore(opts = {}) {
  // Merge user options with defaults
  const options = { ...DEFAULT_OPTS, ...opts };
  // Determine container element
  let containerEl;
  if (typeof document !== 'undefined') {
    if (typeof options.container === 'string') {
      containerEl = document.querySelector(options.container);
    } else if (options.container instanceof HTMLElement) {
      containerEl = options.container;
    }
    if (!containerEl) {
      throw new Error('Invalid container specified for core kit');
    }
    // Ensure container is relative positioned to allow absolute overlays
    const computedPos = window.getComputedStyle(containerEl).position;
    if (computedPos === 'static') {
      containerEl.style.position = 'relative';
    }
  }
  // Instantiate event bus and registry
  const bus = new EventBus();
  const registry = new Registry();
  // Create RNG with seed if provided
  let rngFunc = createRng(typeof options.seed === 'number' ? options.seed : Date.now());
  function rng() {
    return rngFunc();
  }
  // Allow updating seed at runtime (used when loading config)
  function setSeed(seed) {
    rngFunc = createRng(seed);
  }
  // Setup Phaser game. In environments without a DOM (e.g. Node tests),
  // creating a Phaser.Game instance will fail. Detect this and create a
  // minimal stub instead. Phaser requires a document and canvas to run.
  // Determine Phaser library from options or global.
  const PhaserLib = options.Phaser || (typeof window !== 'undefined' ? window.Phaser : undefined);
  let app;
  if (PhaserLib && typeof document !== 'undefined') {
    const gameConfig = {
      type: PhaserLib.AUTO,
      width: options.width,
      height: options.height,
      backgroundColor: options.backgroundColor,
      parent: containerEl,
      physics: { default: 'arcade' },
      scene: [],
    };
    app = new PhaserLib.Game(gameConfig);
  } else {
    // Minimal stub to satisfy core methods in non-browser environments
    app = {
      scene: {
        add: () => {},
        start: () => {},
        get: () => null,
        remove: () => {},
      },
    };
  }
  // Setup input mapping removal handle
  let removeInputHandler = () => {};
  function setInputMapping(mapping) {
    // Remove old handler
    removeInputHandler();
    removeInputHandler = setupInput(mapping, bus);
  }
  // Setup UI primitives if running in browser
  let ui = { dialog: null, hud: null, toast: null };
  if (typeof document !== 'undefined') {
    ui.dialog = createDialog(containerEl, bus);
    ui.hud = createHud(containerEl);
    ui.toast = createToast(containerEl);
  } else {
    // No-op implementations for server environments
    ui.dialog = {
      open: () => {},
      close: () => {},
      isOpen: () => false,
    };
    ui.hud = {
      set: () => {},
      patch: () => {},
    };
    ui.toast = () => {};
  }
  // Placeholder for configuration
  let config = null;
  // Public API: create loader bound to this core
  const loadConfig = createConfigLoader({
    config: null,
    bus,
    app,
    Phaser: PhaserLib,
    setSeed,
    setInputMapping,
  });
  // Scenes map: id -> Phaser.Scene subclass
  const scenes = new Map();
  /**
   * Create and register scenes based on loaded config.
   */
  function setupScenes() {
    if (!config || !Array.isArray(config.scenes)) return;
    config.scenes.forEach((sceneDef) => {
      const sceneKey = sceneDef.id;
      const PhaserClass = PhaserLib;
      class GenericScene extends (PhaserClass ? PhaserClass.Scene : class {}) {
        constructor() {
          super(sceneKey);
        }
        preload() {
          // Assets already loaded in boot scene
        }
        create() {
          // Background
          if (sceneDef.background) {
            const bg = this.add.image(0, 0, sceneDef.background);
            bg.setOrigin(0, 0);
            bus.emit('location:background:drawn', { id: sceneKey, key: sceneDef.background, image: bg });
          }
          // Entities
          if (Array.isArray(sceneDef.entities)) {
            this.npcs = [];
            sceneDef.entities.forEach((entity) => {
              if (entity.type === 'player' || entity.type === 'npc') {
                const [x, y] = entity.spawn;
                const sprite = this.physics.add.sprite(x, y, entity.sprite);
                sprite.setOrigin(0.5, 1);
                sprite.setInteractive();
                sprite.entity = entity;
                if (entity.type === 'player') {
                  this.player = sprite;
                } else {
                  this.npcs.push(sprite);
                }
                if (entity.dialog) {
                  sprite.on('pointerdown', () => {
                    // Emit event for NPC interaction
                    bus.emit('npc:interact', entity);
                  });
                }
              }
            });
          }
          // Emit scene changed event
          bus.emit('core:scene_changed', { id: sceneKey });
          bus.emit('scene:created', { id: sceneKey, scene: this, def: sceneDef });
        }
        update(time, delta) {
          bus.emit('core:tick', delta);
        }
      }
      scenes.set(sceneKey, GenericScene);
      // Add scene to Phaser but don't start yet
      if (!app.scene.getScene(sceneKey)) {
        app.scene.add(sceneKey, GenericScene, false);
      }
    });
  }
  /**
   * Start the initial scene as defined in the configuration.
   */
  function start() {
    if (!config) {
      console.warn('No configuration loaded. Call loadConfig() first.');
      return;
    }
    // Ensure scenes are set up
    setupScenes();
    // Determine starting scene
    const startScene = config.game?.startScene || (config.scenes?.[0]?.id);
    if (!startScene) {
      throw new Error('No start scene defined in configuration');
    }
    app.scene.start(startScene);
  }
  /**
   * Save the current registry state into localStorage.
   * Uses slot names in the form `corekit:slot:${slot}`.
   *
   * @param {string} [slot='0'] Optional slot identifier.
   */
  async function save(slot = '0') {
    const key = `corekit:slot:${slot}`;
    try {
      const data = JSON.stringify(registry.store);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, data);
      }
      bus.emit('core:save', { slot });
    } catch (err) {
      bus.emit('core:error', { type: 'save', error: err });
    }
  }
  /**
   * Load registry state from localStorage.
   * Emits `core:load` when completed.
   *
   * @param {string} [slot='0'] Optional slot identifier.
   */
  async function load(slot = '0') {
    const key = `corekit:slot:${slot}`;
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(key);
        if (data) {
          registry.store = JSON.parse(data);
        }
      }
      bus.emit('core:load', { slot });
    } catch (err) {
      bus.emit('core:error', { type: 'load', error: err });
    }
  }
  // Handle config loaded event to capture config and create scenes
  bus.on('core:config_loaded', (cfg) => {
    config = cfg;
  });
  // Public API object
  const core = {
    apiVersion: '1.0',
    app,
    bus,
    registry,
    rng,
    setSeed,
    setInputMapping,
    loadConfig,
    start,
    save,
    load,
    ui,
    Phaser: PhaserLib,
    get config() {
      return config;
    },
  };
  return core;
}