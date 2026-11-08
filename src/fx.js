(function () {
  'use strict';
  const U = G.Utils;

  const MAX_PARTICLES = 1500;
  const MAX_TEXTS = 90;

  // Visual feedback ("juice"): particles, floating numbers, shockwave rings, screen shake.
  class FX {
    constructor() {
      this.p = [];
      this.texts = [];
      this.rings = [];
      this.trauma = 0; // 0..1, shake strength is trauma^2 for a smooth falloff
    }

    burst(x, y, color, count, speed, life, size) {
      for (let i = 0; i < count && this.p.length < MAX_PARTICLES; i++) {
        const a = Math.random() * Math.PI * 2, sp = speed * U.rand(0.25, 1);
        const l = life * U.rand(0.6, 1);
        this.p.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: l, max: l, size: size * U.rand(0.6, 1.4), color, drag: 4 });
      }
    }

    ghost(x, y, r, color) {
      if (this.p.length < MAX_PARTICLES) this.p.push({ x, y, vx: 0, vy: 0, life: 0.22, max: 0.22, size: r, color, drag: 0, circle: true });
    }

    text(x, y, str, color, size) {
      if (this.texts.length >= MAX_TEXTS) this.texts.shift();
      this.texts.push({ x, y, str, color, size, life: 0.7, max: 0.7, vy: -55 });
    }

    ring(x, y, radius, color, life, width = 3) {
      this.rings.push({ x, y, radius, color, life, max: life, width });
    }

    shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

    shakeOffset() {
      const s = this.trauma * this.trauma * 16;
      return { x: U.rand(-s, s), y: U.rand(-s, s) };
    }

    update(dt) {
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      for (const p of this.p) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f;
        p.life -= dt; if (p.life <= 0) p.dead = true;
      }
      for (const t of this.texts) {
        t.y += t.vy * dt; t.vy *= Math.exp(-4 * dt);
        t.life -= dt; if (t.life <= 0) t.dead = true;
      }
      for (const r of this.rings) { r.life -= dt; if (r.life <= 0) r.dead = true; }
      U.compact(this.p); U.compact(this.texts); U.compact(this.rings);
    }

    draw(ctx, ox, oy) {
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.p) {
        const a = p.life / p.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.circle) {
          ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, p.size, 0, Math.PI * 2); ctx.fill();
        } else {
          const s = p.size * (0.5 + a * 0.5);
          ctx.fillRect(p.x + ox - s / 2, p.y + oy - s / 2, s, s);
        }
      }
      for (const r of this.rings) {
        const k = 1 - r.life / r.max;
        const eased = 1 - Math.pow(1 - k, 3);
        ctx.globalAlpha = r.life / r.max;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width;
        ctx.beginPath();
        ctx.arc(r.x + ox, r.y + oy, Math.max(1, r.radius * eased), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      for (const t of this.texts) {
        ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
        ctx.font = `800 ${t.size}px Rubik, sans-serif`;
        ctx.strokeText(t.str, t.x + ox, t.y + oy);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x + ox, t.y + oy);
      }
      ctx.globalAlpha = 1;
    }
  }

  G.FX = FX;
})();
