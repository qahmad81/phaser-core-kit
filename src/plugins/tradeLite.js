/**
 * TradeLite plugin.
 * Implements a simple marketplace where a single currency is used and prices
 * are fixed. Supports buying and selling items for the main character. Emits
 * trade events on the event bus to signal attempt, success and failure.
 */
export const TradeLite = {
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