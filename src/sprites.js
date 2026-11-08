(function () {
  'use strict';
  const U = G.Utils;

  // Canvas shadowBlur is expensive, so each glowing shape is drawn once into an
  // offscreen canvas and reused. Hundreds of enemies cost one drawImage each.
  const cache = new Map();
  const SCALE = Math.min(2, Math.ceil(window.devicePixelRatio || 1));

  function path(ctx, shape, r) {
    ctx.beginPath();
    switch (shape) {
      case 'circle':
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        break;
      case 'triangle': // arrowhead pointing along +X
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.75, r * 0.8);
        ctx.lineTo(-r * 0.35, 0);
        ctx.lineTo(-r * 0.75, -r * 0.8);
        ctx.closePath();
        break;
      case 'square':
        ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        break;
      case 'diamond':
        ctx.moveTo(r, 0); ctx.lineTo(0, r * 0.65); ctx.lineTo(-r, 0); ctx.lineTo(0, -r * 0.65);
        ctx.closePath();
        break;
      case 'gem':
        ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, 0);
        ctx.closePath();
        break;
      case 'hex':
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case 'star':
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8, rr = i % 2 ? r * 0.62 : r;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        break;
      case 'plus': {
        const t = r * 0.36;
        ctx.moveTo(-t, -r); ctx.lineTo(t, -r); ctx.lineTo(t, -t); ctx.lineTo(r, -t); ctx.lineTo(r, t);
        ctx.lineTo(t, t); ctx.lineTo(t, r); ctx.lineTo(-t, r); ctx.lineTo(-t, t); ctx.lineTo(-r, t);
        ctx.lineTo(-r, -t); ctx.lineTo(-t, -t);
        ctx.closePath();
        break;
      }
    }
  }

  function build(shape, color, r) {
    const pad = Math.ceil(r * 0.8 + 6);
    const half = r + pad;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.ceil(half * 2 * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.translate(half, half);
    ctx.lineJoin = 'round';

    // Outer glow + translucent body + bright outline
    ctx.shadowColor = color;
    ctx.shadowBlur = pad;
    path(ctx, shape, r);
    ctx.fillStyle = U.hexToRgba(color, shape === 'gem' ? 0.85 : 0.25);
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.strokeStyle = color;
    ctx.stroke();

    // Hot core
    ctx.shadowBlur = 0;
    path(ctx, shape, r * 0.42);
    ctx.fillStyle = U.hexToRgba(color, 0.9);
    ctx.fill();

    return { canvas, half };
  }

  G.Sprites = {
    get(shape, color, r) {
      const key = shape + color + r;
      let s = cache.get(key);
      if (!s) { s = build(shape, color, r); cache.set(key, s); }
      return s;
    },
  };
})();
