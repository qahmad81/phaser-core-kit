/**
 * CharactersLite plugin.
 * Manages a lightweight representation of characters including name, sprite,
 * money and energy. Changes to a character emit `char:changed` events on the
 * bus. Data is stored in the registry under keys `char.<id>.*`.
 */
export const CharactersLite = {
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