(function () {
  'use strict';

  const U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    dist2: (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },

    weightedPick(items, weightOf) {
      let total = 0;
      for (const it of items) total += weightOf(it);
      let r = Math.random() * total;
      for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
      return items[items.length - 1];
    },

    formatTime(s) {
      s = Math.max(0, Math.floor(s));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    },

    // Removes objects flagged `dead` in place, without allocating a new array.
    compact(arr) {
      let j = 0;
      for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
      arr.length = j;
    },

    hexToRgba(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    },
  };

  // Uniform grid for broad-phase collision: instead of checking every bullet
  // against every enemy (O(n*m)), we only check enemies in nearby cells.
  class SpatialHash {
    constructor(cellSize) { this.cell = cellSize; this.map = new Map(); }
    clear() { this.map.clear(); }
    key(cx, cy) { return (cx + 32768) * 65536 + (cy + 32768); }
    insert(o) {
      const k = this.key(Math.floor(o.x / this.cell), Math.floor(o.y / this.cell));
      const bucket = this.map.get(k);
      if (bucket) bucket.push(o); else this.map.set(k, [o]);
    }
    // Objects are stored by center, so callers pad `r` by the largest object radius.
    query(x, y, r, out) {
      out.length = 0;
      const c = this.cell;
      const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
      const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const b = this.map.get(this.key(cx, cy));
          if (b) for (let i = 0; i < b.length; i++) out.push(b[i]);
        }
      }
      return out;
    }
  }
  U.SpatialHash = SpatialHash;

  G.Utils = U;

  G.Storage = {
    KEY: 'emberSwarm.best',
    load() {
      try { return JSON.parse(localStorage.getItem(this.KEY)) || { score: 0, time: 0 }; }
      catch (e) { return { score: 0, time: 0 }; }
    },
    save(best) {
      try { localStorage.setItem(this.KEY, JSON.stringify(best)); } catch (e) { /* private mode */ }
    },
  };
})();
