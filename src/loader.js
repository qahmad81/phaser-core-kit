import yaml from 'js-yaml';

/**
 * Create a configuration loader bound to a core instance.
 * The loader is responsible for fetching and parsing game configuration files
 * (JSON or YAML), validating the schema version and loading assets via a
 * temporary boot scene. After loading assets it emits `core:config_loaded`.
 *
 * @param {object} core The core instance.
 * @returns {(urlOrObject: string|object) => Promise<void>}
 */
export function createConfigLoader(core) {
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