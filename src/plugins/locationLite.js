/**
 * LocationLite plugin.
 * Provides lightweight handling of scenes/locations. In the Lite version it simply
 * stores scene definitions from the configuration and exposes them through
 * `core.locations.get(sceneId)`. No dynamic effects are implemented.
 */
export const LocationLite = {
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