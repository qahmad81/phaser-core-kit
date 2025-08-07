/**
 * DialogueLite plugin.
 * Provides simple branching dialogues defined in the game configuration under `dialogues`.
 * Each dialogue consists of lines with text and options. Selecting an option can
 * trigger an action such as giving/taking items, adding money, closing the dialog
 * or changing scenes. More advanced behaviours can be handled by other plugins
 * listening for the `dialog:choose` event.
 */
export const DialogueLite = {
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