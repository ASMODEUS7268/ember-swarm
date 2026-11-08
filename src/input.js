(function () {
  'use strict';

  // Keys that the browser would otherwise use for scrolling or button activation.
  const BLOCKED = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  G.Input = {
    keys: new Set(),     // currently held
    pressed: new Set(),  // went down this frame

    init() {
      window.addEventListener('keydown', e => {
        if (!e.repeat) this.pressed.add(e.code);
        this.keys.add(e.code);
        if (BLOCKED.has(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', e => this.keys.delete(e.code));
      window.addEventListener('blur', () => { this.keys.clear(); this.pressed.clear(); });
    },

    down(code) { return this.keys.has(code); },

    consume(code) {
      if (!this.pressed.has(code)) return false;
      this.pressed.delete(code);
      return true;
    },

    endFrame() { this.pressed.clear(); },

    axis() {
      let x = 0, y = 0;
      if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
      if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
      if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
      if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
  };
})();
