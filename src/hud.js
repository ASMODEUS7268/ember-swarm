(function () {
  'use strict';
  const C = G.CONFIG, U = G.Utils;
  const TITLE = '"Russo One", sans-serif';
  const BODY = 'Rubik, sans-serif';
  const MUTED = 'rgba(232,246,255,0.55)';

  function pill(ctx, x, y, w, h) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
  }

  function bar(ctx, x, y, w, h, frac, color) {
    pill(ctx, x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    frac = U.clamp(frac, 0, 1);
    if (frac > 0) {
      pill(ctx, x, y, Math.max(h, w * frac), h);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  G.drawHud = function (ctx, g) {
    const p = g.player, w = g.w, h = g.h;
    ctx.save();
    ctx.textBaseline = 'top';

    // XP bar across the top
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, w, 6);
    const xpGrad = ctx.createLinearGradient(0, 0, w, 0);
    xpGrad.addColorStop(0, '#4de8ff');
    xpGrad.addColorStop(1, '#a77dff');
    ctx.fillStyle = xpGrad;
    ctx.fillRect(0, 0, w * U.clamp(p.xp / p.xpNext, 0, 1), 6);

    // Level, HP, dash
    ctx.textAlign = 'left';
    ctx.font = `20px ${TITLE}`;
    ctx.fillStyle = '#e8f6ff';
    ctx.fillText('УР. ' + p.level, 18, 18);

    const hpFrac = p.hp / p.stats.maxHp;
    bar(ctx, 18, 46, 240, 14, hpFrac, hpFrac < 0.35 ? '#ff3b5c' : '#ff5a7a');
    ctx.font = `600 11px ${BODY}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.stats.maxHp}`, 26, 47);

    const dashFrac = 1 - U.clamp(p.dashCd / p.stats.dashCooldown, 0, 1);
    bar(ctx, 18, 68, 120, 6, dashFrac, dashFrac >= 1 ? '#7ff6ff' : 'rgba(127,246,255,0.4)');
    ctx.font = `600 10px ${BODY}`;
    ctx.fillStyle = MUTED;
    ctx.fillText('РЫВОК', 146, 66);

    // Timer
    ctx.textAlign = 'center';
    ctx.font = `34px ${TITLE}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(U.formatTime(g.time), w / 2, 16);
    const remain = C.RUN_DURATION - g.time;
    ctx.font = `600 11px ${BODY}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(remain > 0 ? `до победы ${U.formatTime(remain)}` : 'победи последнего босса!', w / 2, 54);

    // Kills
    ctx.textAlign = 'right';
    ctx.font = `20px ${TITLE}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(String(g.kills), w - 18, 18);
    ctx.font = `600 10px ${BODY}`;
    ctx.fillStyle = MUTED;
    ctx.fillText('УБИТО', w - 18, 42);

    // Boss health
    if (g.boss && !g.boss.dead) {
      const bw = Math.min(460, w - 40), bx = (w - bw) / 2, by = 78;
      ctx.textAlign = 'center';
      ctx.font = `14px ${TITLE}`;
      ctx.fillStyle = '#ff8099';
      ctx.fillText(g.boss.name, w / 2, by);
      bar(ctx, bx, by + 20, bw, 10, g.boss.hp / g.boss.maxHp, '#ff3355');
    }

    // Center banner (waves, bosses)
    if (g.banner) {
      const b = g.banner;
      ctx.globalAlpha = Math.min(1, (b.dur - b.t) * 4, b.t * 2);
      ctx.textAlign = 'center';
      ctx.font = `42px ${TITLE}`;
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = '#ff8a3d';
      ctx.shadowBlur = 20;
      ctx.fillText(b.text, w / 2, h * 0.24);
      ctx.shadowBlur = 0;
      if (b.sub) {
        ctx.font = `600 16px ${BODY}`;
        ctx.fillStyle = '#e8f6ff';
        ctx.fillText(b.sub, w / 2, h * 0.24 + 54);
      }
      ctx.globalAlpha = 1;
    }

    if (g.debug) {
      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      ctx.fillStyle = '#8f8';
      ctx.fillText(`FPS ${g.fps | 0} | враги ${g.enemies.length} | пули ${g.bullets.length}/${g.enemyBullets.length} | кристаллы ${g.gems.length} | частицы ${g.fx.p.length}`, 18, h - 40);
      ctx.fillText('K убить всех · L уровень · T +30с · B босс · G бессмертие', 18, h - 22);
    }
    ctx.restore();
  };
})();
