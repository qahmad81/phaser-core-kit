/**
 * MovementLite plugin.
 * Provides basic player movement in either 'topdown' or 'horizontal' modes
 * and emits interaction events when the appropriate key is pressed.
 */
export const MovementLite = {
  /**
   * Initialise the movement plugin.
   * @param {import('../types').Core} core
   */
  init(core) {
    const bus = core.bus;
    const Phaser = core.Phaser;
    let scene = null;
    let cursors = null;
    let interactKey = null;
    let mode = 'topdown';
    // When a scene is created, set up player controls
    bus.on('scene:created', ({ scene: sc }) => {
      scene = sc;
      const player = sc.player;
      if (!player) return;
      mode = player.entity?.movement || 'topdown';
      player.body.setCollideWorldBounds(true);
      if (mode === 'horizontal') {
        player.body.setGravityY(600);
      }
      cursors = sc.input.keyboard.createCursorKeys();
      interactKey = mode === 'horizontal'
        ? sc.input.keyboard.addKey('E')
        : sc.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      interactKey.on('down', () => {
        const p = sc.player;
        const npcs = sc.npcs || [];
        for (const npc of npcs) {
          const dist = Phaser.Math.Distance.Between(p.x, p.y, npc.x, npc.y);
          if (dist < 40 && npc.entity?.dialog) {
            bus.emit('npc:interact', npc.entity);
            break;
          }
        }
        bus.emit('player:interact', { mode });
      });
    });
    // Update movement each tick
    bus.on('core:tick', () => {
      if (!scene || !scene.player || !cursors) return;
      const player = scene.player;
      if (mode === 'topdown') {
        const speed = 150;
        player.body.setVelocity(0);
        if (cursors.left.isDown) player.body.setVelocityX(-speed);
        else if (cursors.right.isDown) player.body.setVelocityX(speed);
        if (cursors.up.isDown) player.body.setVelocityY(-speed);
        else if (cursors.down.isDown) player.body.setVelocityY(speed);
      } else {
        const speed = 150;
        const jump = 300;
        if (cursors.left.isDown) player.body.setVelocityX(-speed);
        else if (cursors.right.isDown) player.body.setVelocityX(speed);
        else player.body.setVelocityX(0);
        if (Phaser.Input.Keyboard.JustDown(cursors.up) && player.body.blocked.down) {
          player.body.setVelocityY(-jump);
        }
      }
    });
  },
};
