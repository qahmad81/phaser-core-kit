(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('js-yaml')) :
  typeof define === 'function' && define.amd ? define(['exports', 'js-yaml'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.PCore = {}, global.jsyaml));
})(this, (function (exports, yaml) { 'use strict';

  /**
   * Simple EventBus implementation.
   * Allows registering, unregistering, and emitting events with payloads.
   *
   * The bus stores handlers in a Map keyed by event name.
   * Handlers are invoked synchronously when an event is emitted.
   */
  class EventBus {
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

  /**
   * Simple shared state registry.
   *
   * Keys are strings using dot notation for nested structures.
   * Observers can subscribe to changes on specific keys. When a key is set,
   * all observers for that key are invoked with the new value.
   */
  class Registry {
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

  /**
   * Create a deterministic pseudo-random number generator using a seed.
   * Implements the mulberry32 algorithm. Each invocation of the returned
   * function returns a floating point number in the range [0,1).
   *
   * @param {number} seed Seed value for the PRNG.
   * @returns {() => number} Function that returns a pseudo-random number.
   */
  function createRng(seed = Date.now()) {
    // Ensure seed is a 32‑bit integer
    let t = Math.imul(seed, 0x6d2b79f5) | 0;
    return function rng() {
      // Force to 32 bit integer arithmetic
      t |= 0;
      t = (t + 0x6d2b79f5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Create a dialog UI primitive.
   * A dialog is rendered as a floating HTML element on top of the Phaser canvas.
   * It supports a title, text content and multiple options. Selecting an option
   * will emit a `dialog:choose` event on the provided EventBus with the option value.
   *
   * @param {HTMLElement} container The parent container to attach the dialog overlay.
   * @param {EventBus} bus Event bus for emitting dialog events.
   * @returns {import("../types").DialogAPI}
   */
  function createDialog(container, bus) {
    // Create overlay element lazily
    let overlay = null;
    let isOpen = false;

    function ensureOverlay() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'pcore-dialog-overlay';
      Object.assign(overlay.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
      });
      container.appendChild(overlay);
    }

    /**
     * Open a dialog with the given model.
     *
     * @param {{title?:string,text:string,options?:{label:string,value:any}[]}} model
     * @param {(val:any)=>void} [onChoose]
     */
    function open(model, onChoose) {
      ensureOverlay();
      // Clear existing content
      overlay.innerHTML = '';
      // Create dialog container
      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        background: '#fff',
        padding: '1rem',
        borderRadius: '8px',
        minWidth: '300px',
        maxWidth: '80%',
        color: '#333',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        fontFamily: 'sans-serif',
      });
      if (model.title) {
        const titleEl = document.createElement('div');
        titleEl.textContent = model.title;
        titleEl.style.fontWeight = 'bold';
        titleEl.style.marginBottom = '0.5rem';
        dialog.appendChild(titleEl);
      }
      const textEl = document.createElement('div');
      textEl.textContent = model.text;
      textEl.style.marginBottom = '1rem';
      dialog.appendChild(textEl);
      if (model.options && model.options.length > 0) {
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.flexDirection = 'column';
        btnContainer.style.gap = '0.5rem';
        model.options.forEach((opt) => {
          const btn = document.createElement('button');
          btn.textContent = opt.label;
          Object.assign(btn.style, {
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '1rem',
          });
          btn.addEventListener('click', () => {
            bus.emit('dialog:choose', opt.value);
            if (typeof onChoose === 'function') {
              onChoose(opt.value);
            }
            close();
          });
          btnContainer.appendChild(btn);
        });
        dialog.appendChild(btnContainer);
      } else {
        // If no options, clicking dialog closes it
        dialog.addEventListener('click', () => close());
      }
      overlay.appendChild(dialog);
      isOpen = true;
      bus.emit('dialog:open', model);
    }

    /** Close the dialog if open. */
    function close() {
      if (!overlay || !isOpen) return;
      overlay.innerHTML = '';
      isOpen = false;
      bus.emit('dialog:close');
    }

    function getIsOpen() {
      return isOpen;
    }

    return { open, close, isOpen: getIsOpen };
  }

  /**
   * Create a HUD (heads up display) UI primitive.
   * The HUD is a simple horizontal bar at the top of the container showing
   * key‑value pairs (e.g. money, energy). Values can be set entirely or patched.
   *
   * @param {HTMLElement} container Parent container to append HUD.
   * @returns {import("../types").HudAPI}
   */
  function createHud(container) {
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

  /**
   * Create a simple toast notification system.
   * The toast will appear at the bottom of the container and disappear after a short delay.
   *
   * @param {HTMLElement} container Parent container to attach toast overlay.
   * @returns {(msg: string, duration?: number) => void}
   */
  function createToast(container) {
    let toastEl = document.createElement('div');
    toastEl.className = 'pcore-toast';
    Object.assign(toastEl.style, {
      position: 'absolute',
      bottom: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '0.5rem 1rem',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: '#fff',
      borderRadius: '4px',
      fontFamily: 'sans-serif',
      opacity: '0',
      transition: 'opacity 0.3s',
      pointerEvents: 'none',
      zIndex: 950,
    });
    container.appendChild(toastEl);
    let hideTimeout;
    return function toast(msg, duration = 2000) {
      toastEl.textContent = msg;
      toastEl.style.opacity = '1';
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        toastEl.style.opacity = '0';
      }, duration);
    };
  }

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
  function setupInput(mapping, bus) {
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

  /**
   * Create a configuration loader bound to a core instance.
   * The loader is responsible for fetching and parsing game configuration files
   * (JSON or YAML), validating the schema version and loading assets via a
   * temporary boot scene. After loading assets it emits `core:config_loaded`.
   *
   * @param {object} core The core instance.
   * @returns {(urlOrObject: string|object) => Promise<void>}
   */
  function createConfigLoader(core) {
    /**
     * Stub migration function for future schema upgrades.
     * Currently logs a warning and returns the original config.
     *
     * @param {any} cfg The configuration object to migrate.
     * @returns {any} The migrated configuration.
     */
    function migrate(cfg) {
      console.warn('Config schema migration not implemented. Loaded schema version:', cfg.schemaVersion);
      return cfg;
    }
    return async function loadConfig(urlOrObject) {
      let cfg;
      if (typeof urlOrObject === 'string') {
        // Fetch remote config
        const response = await fetch(urlOrObject);
        const text = await response.text();
        // Determine whether YAML (contains ':' at top?) or JSON (starts with '{')
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          cfg = JSON.parse(trimmed);
        } else {
          cfg = yaml.load(trimmed);
        }
      } else if (typeof urlOrObject === 'object') {
        cfg = urlOrObject;
      } else {
        throw new Error('Unsupported configuration input');
      }
      // Migrate if schema versions differ (assume latest is 1.0)
      if (cfg.schemaVersion !== '1.0') {
        cfg = migrate(cfg);
      }
      // Store config on core for later use
      core.config = cfg;
      // Setup seed if provided in game section and not previously set
      if (cfg.game && typeof cfg.game.seed === 'number') {
        core.setSeed(cfg.game.seed);
      }
      // Setup input mapping
      if (cfg.input) {
        core.setInputMapping(cfg.input);
      }
      // In environments without a DOM (non-browser), skip asset loading and
      // immediately emit config loaded.
      if (typeof document === 'undefined' || !core.app.scene || !core.Phaser) {
        core.bus.emit('core:config_loaded', cfg);
        return;
      }
      // Prepare boot scene to load assets
      const BootScene = new core.Phaser.Scene('Boot');
      BootScene.preload = function () {
        if (Array.isArray(cfg.assets)) {
          cfg.assets.forEach((asset) => {
            if (asset.type === 'image') {
              this.load.image(asset.key, asset.url);
            }
            // Extend here for other asset types as needed
          });
        }
      };
      BootScene.create = function () {
        // Emit config loaded event with config
        core.bus.emit('core:config_loaded', cfg);
        // Remove boot scene and stop it
        this.scene.stop('Boot');
        core.app.scene.remove('Boot');
        // Resolve outer promise
        loadResolve();
      };
      // Promise resolution handle captured here
      let loadResolve;
      const loadPromise = new Promise((resolve) => {
        loadResolve = resolve;
      });
      // Add and start boot scene
      core.app.scene.add('Boot', BootScene, true);
      return loadPromise;
    };
  }

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
  function createCore(opts = {}) {
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
            }
            // Entities
            if (Array.isArray(sceneDef.entities)) {
              sceneDef.entities.forEach((entity) => {
                if (entity.type === 'player' || entity.type === 'npc') {
                  const [x, y] = entity.spawn;
                  const sprite = this.add.sprite(x, y, entity.sprite);
                  sprite.setOrigin(0.5, 1);
                  sprite.setInteractive();
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
          }
          update(time, delta) {
            bus.emit('core:tick', delta);
          }
        }
        scenes.set(sceneKey, GenericScene);
        // Add scene to Phaser but don't start yet
        if (!app.scene.get(sceneKey)) {
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

  /**
   * DialogueLite plugin.
   * Provides simple branching dialogues defined in the game configuration under `dialogues`.
   * Each dialogue consists of lines with text and options. Selecting an option can
   * trigger an action such as giving/taking items, adding money, closing the dialog
   * or changing scenes. More advanced behaviours can be handled by other plugins
   * listening for the `dialog:choose` event.
   */
  const DialogueLite = {
    /**
     * Initialise the DialogueLite plugin with the core instance.
     *
     * @param {import('../types').Core} core
     */
    init(core) {
      const bus = core.bus;
      // Map of dialogue id to definition
      let dialogues = {};
      // Load dialogues from config once config is loaded
      bus.on('core:config_loaded', (cfg) => {
        dialogues = {};
        if (Array.isArray(cfg.dialogues)) {
          cfg.dialogues.forEach((d) => {
            dialogues[d.id] = d;
          });
        }
      });
      // Helper to run an action
      async function runAction(action) {
        if (!action || typeof action !== 'object') return;
        const type = action.type;
        switch (type) {
          case 'close_dialog':
            core.ui.dialog.close();
            break;
          case 'give_item':
            if (core.inventory && typeof core.inventory.add === 'function') {
              core.inventory.add(action.id, action.q ?? 1);
            }
            break;
          case 'take_item':
            if (core.inventory && typeof core.inventory.remove === 'function') {
              core.inventory.remove(action.id, action.q ?? 1);
            }
            break;
          case 'add_money':
            if (core.characters && typeof core.characters.addMoney === 'function') {
              core.characters.addMoney('hero', action.amount ?? 0);
            }
            break;
          case 'goto_scene':
            if (typeof action.id === 'string') {
              core.app.scene.start(action.id);
            }
            break;
          case 'trade':
            // Delegated to TradeLite plugin
            if (core.trade && typeof core.trade.handleDialogTrade === 'function') {
              core.trade.handleDialogTrade(action);
            }
            break;
          default:
            // Unknown actions are emitted for others to handle
            bus.emit('dialog:action', action);
        }
      }
      /**
       * Open a dialogue by id.
       * @param {string} id
       */
      function open(id) {
        const dlg = dialogues[id];
        if (!dlg) {
          console.warn('Dialogue not found:', id);
          return;
        }
        // For simplicity support only first line
        const line = dlg.lines?.[0];
        if (!line) return;
        const model = {
          title: dlg.title ?? undefined,
          text: line.text,
          options: line.options?.map((opt) => ({ label: opt.label, value: opt.action })) ?? [],
        };
        core.ui.dialog.open(model, (selectedAction) => {
          // Emit choose event with action payload
          bus.emit('dialog:choose', { dialogId: id, action: selectedAction });
          runAction(selectedAction);
        });
      }
      /**
       * Close currently open dialogue.
       */
      function close() {
        core.ui.dialog.close();
      }
      // Listen for NPC interactions to open associated dialogues
      bus.on('npc:interact', (entity) => {
        if (entity && entity.dialog) {
          open(entity.dialog);
        }
      });
      // Attach to core
      core.dialogue = {
        open,
        close,
        getAvailable: () => Object.keys(dialogues),
      };
    },
  };

  /**
   * InventoryLite plugin.
   * Provides a simple inventory where items are identified by id and stored with
   * quantities. No rarity or quality are tracked. Supports shared inventory and
   * per‑character inventories.
   */
  const InventoryLite = {
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

  /**
   * TradeLite plugin.
   * Implements a simple marketplace where a single currency is used and prices
   * are fixed. Supports buying and selling items for the main character. Emits
   * trade events on the event bus to signal attempt, success and failure.
   */
  const TradeLite = {
    /**
     * Initialise the trade plugin.
     *
     * @param {import('../types').Core} core
     */
    init(core) {
      const bus = core.bus;
      // Load shops from config (not actively used in Lite for pricing)
      let shops = {};
      bus.on('core:config_loaded', (cfg) => {
        shops = {};
        if (Array.isArray(cfg.shops)) {
          cfg.shops.forEach((shop) => {
            shops[shop.id] = shop;
          });
        }
      });
      /**
       * Attempt to buy an item for a character.
       * @param {string} item Item identifier
       * @param {number} price Unit price
       * @param {number} q Quantity
       * @param {string} charId Character id (default hero)
       */
      function buy(item, price, q = 1, charId = 'hero') {
        const total = price * q;
        bus.emit('trade:attempt', { op: 'buy', item, price, q, charId });
        const money = core.characters.getMoney(charId);
        if (money >= total) {
          core.characters.addMoney(charId, -total);
          core.inventory.add(item, q, charId);
          bus.emit('trade:success', { op: 'buy', item, price, q, charId });
          return true;
        } else {
          bus.emit('trade:fail', { op: 'buy', item, reason: 'insufficient_funds', charId });
          core.ui.toast && core.ui.toast('Not enough money');
          return false;
        }
      }
      /**
       * Attempt to sell an item for a character.
       * @param {string} item Item identifier
       * @param {number} price Unit price
       * @param {number} q Quantity
       * @param {string} charId Character id
       */
      function sell(item, price, q = 1, charId = 'hero') {
        bus.emit('trade:attempt', { op: 'sell', item, price, q, charId });
        if (core.inventory.has(item, q, charId)) {
          core.inventory.remove(item, q, charId);
          core.characters.addMoney(charId, price * q);
          bus.emit('trade:success', { op: 'sell', item, price, q, charId });
          return true;
        } else {
          bus.emit('trade:fail', { op: 'sell', item, reason: 'not_in_inventory', charId });
          core.ui.toast && core.ui.toast('Not enough items');
          return false;
        }
      }
      /**
       * Handle trade actions triggered from dialogues.
       * @param {{op:'buy'|'sell', item:string, price:number, q?:number}} action
       */
      function handleDialogTrade(action) {
        const { op, item, price, q = 1 } = action;
        if (op === 'buy') {
          buy(item, price, q);
        } else if (op === 'sell') {
          sell(item, price, q);
        }
      }
      // Attach API to core
      core.trade = { buy, sell, handleDialogTrade };
    },
  };

  /**
   * CharactersLite plugin.
   * Manages a lightweight representation of characters including name, sprite,
   * money and energy. Changes to a character emit `char:changed` events on the
   * bus. Data is stored in the registry under keys `char.<id>.*`.
   */
  const CharactersLite = {
    /**
     * Initialise characters from configuration and expose API on core.
     *
     * @param {import('../types').Core} core
     */
    init(core) {
      const bus = core.bus;
      const registry = core.registry;
      // Load characters from config
      bus.on('core:config_loaded', (cfg) => {
        if (Array.isArray(cfg.characters)) {
          cfg.characters.forEach((char) => {
            const baseKey = `char.${char.id}`;
            registry.set(`${baseKey}.name`, char.name);
            registry.set(`${baseKey}.sprite`, char.sprite);
            registry.set(`${baseKey}.money`, char.money ?? 0);
            registry.set(`${baseKey}.energy`, char.energy ?? 0);
          });
        }
      });
      function getMoney(id) {
        return registry.get(`char.${id}.money`) ?? 0;
      }
      function addMoney(id, amount) {
        const key = `char.${id}.money`;
        const current = registry.get(key) ?? 0;
        const newVal = current + amount;
        registry.set(key, newVal);
        bus.emit('char:changed', { id, key: 'money', value: newVal });
      }
      function getEnergy(id) {
        return registry.get(`char.${id}.energy`) ?? 0;
      }
      function addEnergy(id, amount) {
        const key = `char.${id}.energy`;
        const current = registry.get(key) ?? 0;
        const newVal = current + amount;
        registry.set(key, newVal);
        bus.emit('char:changed', { id, key: 'energy', value: newVal });
      }
      function setEnergy(id, value) {
        registry.set(`char.${id}.energy`, value);
        bus.emit('char:changed', { id, key: 'energy', value });
      }
      // Attach API
      core.characters = { getMoney, addMoney, getEnergy, addEnergy, setEnergy };
    },
  };

  /**
   * LocationLite plugin.
   * Provides lightweight handling of scenes/locations. In the Lite version it simply
   * stores scene definitions from the configuration and exposes them through
   * `core.locations.get(sceneId)`. No dynamic effects are implemented.
   */
  const LocationLite = {
    /**
     * Initialise the location plugin.
     *
     * @param {import('../types').Core} core
     */
    init(core) {
      const bus = core.bus;
      let scenes = {};
      bus.on('core:config_loaded', (cfg) => {
        scenes = {};
        if (Array.isArray(cfg.scenes)) {
          cfg.scenes.forEach((sc) => {
            scenes[sc.id] = sc;
          });
        }
      });
      core.locations = {
        /** Get a scene definition by id. */
        get: (id) => scenes[id],
        /** List all scene ids. */
        list: () => Object.keys(scenes),
      };
    },
  };

  exports.CharactersLite = CharactersLite;
  exports.DialogueLite = DialogueLite;
  exports.InventoryLite = InventoryLite;
  exports.LocationLite = LocationLite;
  exports.TradeLite = TradeLite;
  exports.createCore = createCore;

}));
