(function () {
  'use strict';
  const C = G.CONFIG, U = G.Utils;

  // States: menu -> playing <-> (paused | levelup) -> ending (slow-mo) -> over
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.debug = new URLSearchParams(location.search).has('debug');
      this.state = 'menu';
      this.player = null;
      this.menuTime = 0;
      this.fps = 60;
      this._q = [];
      this.best = G.Storage.load();
      this.ui = new G.UI(this);

      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('blur', () => this.pause());
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });

      this.ui.showMenu();
      this.last = performance.now();
      requestAnimationFrame(t => this.frame(t));
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.despawnDist = Math.hypot(this.w, this.h) * 0.5 + 450;
    }

    // ------------------------------------------------------------ lifecycle
    start() {
      G.Audio.init();
      this.time = 0; this.kills = 0; this.score = 0; this.bossKills = 0; this.nextId = 1;
      this.player = new G.Player();
      this.enemies = []; this.bullets = []; this.enemyBullets = []; this.gems = []; this.pickups = [];
      this.fx = new G.FX();
      this.hash = new U.SpatialHash(64);
      this.director = new G.Director(this);
      this.cam = { x: 0, y: 0 };
      this.pendingLevelUps = 0;
      this.boss = null;
      this.hitStop = 0;
      this.banner = null;
      this.gemCombo = 0; this.gemComboTimer = 0; this.gemMergeIdx = 0;
      this.victory = false; this.godMode = false;
      this.state = 'playing';
      this.ui.hideAll();
      G.Input.endFrame();
      this.showBanner('Продержись 10 минут', 'WASD — движение · Пробел — рывок', 3.5);
    }

    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.ui.showPause(this.player);
    }

    resume() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      this.ui.hideAll();
      G.Input.endFrame();
    }

    toMenu() {
      this.state = 'menu';
      this.player = null;
      this.ui.showMenu();
    }

    end(victory) {
      if (this.state !== 'playing') return;
      const p = this.player;
      this.victory = victory;
      this.finalTime = this.time;
      this.state = 'ending';
      this.endTimer = victory ? 2.2 : 1.6;
      if (victory) {
        p.invuln = 999;
        for (const e of this.enemies) { e.dead = true; this.fx.burst(e.x, e.y, e.def.color, 6, 200, 0.6, 3); }
        this.enemyBullets.length = 0;
        this.showBanner('ПОБЕДА!', 'Рой отступает', 3);
        G.Audio.play('victory');
      } else {
        p.dead = true;
        this.fx.burst(p.x, p.y, '#7ff6ff', 60, 380, 1.1, 4);
        this.fx.ring(p.x, p.y, 160, '#7ff6ff', 0.6, 4);
        this.fx.shake(1);
        G.Audio.play('death');
      }
    }

    showResults() {
      this.state = 'over';
      const score = this.score + Math.floor(this.finalTime) * 5 + (this.victory ? 5000 : 0);
      const best = this.best;
      const isRecord = score > best.score;
      if (isRecord) best.score = score;
      best.time = Math.max(best.time, this.finalTime);
      G.Storage.save(best);
      this.ui.showGameOver({
        victory: this.victory, score, isRecord, time: this.finalTime,
        kills: this.kills, level: this.player.level, bossKills: this.bossKills, best,
        player: this.player,
      });
    }

    // ------------------------------------------------------------ level-up
    openLevelUp() {
      this.state = 'levelup';
      this.choices = G.pickUpgrades(this.player, 3);
      this.ui.showLevelUp(this.choices, this.player);
      G.Audio.play('levelup');
      this.fx.ring(this.player.x, this.player.y, 90, '#a77dff', 0.5, 3);
    }

    chooseUpgrade(i) {
      if (this.state !== 'levelup' || !this.ui.canPick()) return;
      const up = this.choices[i];
      if (!up) return;
      G.applyUpgrade(this.player, up, this);
      this.pendingLevelUps--;
      G.Audio.play('click');
      this.state = 'playing';
      this.ui.hideAll();
      G.Input.endFrame();
      if (this.pendingLevelUps > 0) this.openLevelUp();
    }

    // ------------------------------------------------------------ main loop
    frame(now) {
      const raw = (now - this.last) / 1000;
      this.last = now;
      const dt = Math.min(raw, 0.05); // avoid huge jumps after a tab switch
      this.fps = U.lerp(this.fps, 1 / Math.max(raw, 0.001), 0.05);

      this.handleKeys();
      if (this.state === 'playing') {
        if (this.hitStop > 0) this.hitStop -= dt; else this.update(dt);
      } else if (this.state === 'ending') {
        this.endTimer -= dt;
        this.update(dt * 0.3); // slow motion finish
        if (this.endTimer <= 0) this.showResults();
      } else if (this.state === 'menu') {
        this.menuTime += dt;
      }

      this.render();
      G.Input.endFrame();
      requestAnimationFrame(t => this.frame(t));
    }

    handleKeys() {
      const I = G.Input;
      if (I.consume('KeyM')) {
        G.Audio.init();
        const muted = G.Audio.toggleMute();
        if (this.player) this.showBanner(muted ? 'Звук выключен' : 'Звук включён', '', 1.2);
        this.ui.updateMute(muted);
      }
      switch (this.state) {
        case 'menu':
          if (I.consume('Enter') || I.consume('Space')) this.start();
          break;
        case 'over':
          if (I.consume('Enter')) this.start();
          else if (I.consume('Escape')) this.toMenu();
          break;
        case 'playing':
          if (I.consume('Escape') || I.consume('KeyP')) this.pause();
          if (this.debug) this.debugKeys();
          break;
        case 'paused':
          if (I.consume('Escape') || I.consume('KeyP')) this.resume();
          break;
        case 'levelup':
          for (let i = 0; i < 3; i++) if (I.consume('Digit' + (i + 1)) || I.consume('Numpad' + (i + 1))) this.chooseUpgrade(i);
          break;
      }
    }

    debugKeys() {
      const I = G.Input;
      if (I.consume('KeyK')) for (const e of this.enemies) if (!e.dead && e !== this.boss) this.killEnemy(e);
      if (I.consume('KeyL')) this.pendingLevelUps++;
      if (I.consume('KeyT')) this.time += 30;
      if (I.consume('KeyB') && !this.boss) this.director.spawnBoss();
      if (I.consume('KeyG')) { this.godMode = !this.godMode; this.showBanner(this.godMode ? 'Бессмертие ВКЛ' : 'Бессмертие ВЫКЛ', '', 1); }
    }

    update(dt) {
      this.time += dt;
      const p = this.player;

      this.hash.clear();
      for (const e of this.enemies) this.hash.insert(e);

      if (!p.dead) p.update(dt, this);
      if (this.state === 'playing') this.director.update(dt);
      for (const e of this.enemies) if (!e.dead) e.update(dt, this);
      this.updateBullets(dt);
      this.updateEnemyBullets(dt);
      this.updateGems(dt);
      this.updatePickups(dt);
      if (!p.dead) this.collidePlayer();

      U.compact(this.enemies); U.compact(this.bullets); U.compact(this.enemyBullets);
      U.compact(this.gems); U.compact(this.pickups);
      this.fx.update(dt);

      if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
      if ((this.gemComboTimer -= dt) <= 0) this.gemCombo = 0;

      const k = 1 - Math.exp(-dt * 8);
      this.cam.x += (p.x - this.cam.x) * k;
      this.cam.y += (p.y - this.cam.y) * k;

      if (this.state !== 'playing') return;
      const allBossesDone = this.director.bossIndex >= C.BOSS_TIMES.length && !this.boss;
      if (this.time >= C.RUN_DURATION && allBossesDone) this.end(true);
      else if (this.pendingLevelUps > 0) this.openLevelUp();
    }

    // ------------------------------------------------------------ combat
    nearestEnemy(x, y, range, exclude) {
      let best = null, bd = range * range;
      for (const e of this.enemies) {
        if (e.dead || (exclude && exclude.has(e.id))) continue;
        const d = U.dist2(x, y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    // Nearest enemy, except a boss in range counts as closer than it is,
    // so it doesn't hide forever behind its own minions.
    gunTarget(x, y, range) {
      const b = this.boss;
      if (b && !b.dead && U.dist2(x, y, b.x, b.y) < range * range && Math.random() < 0.75) return b;
      return this.nearestEnemy(x, y, range);
    }

    updateBullets(dt) {
      for (const b of this.bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if ((b.life -= dt) <= 0) { b.dead = true; continue; }
        for (const e of this.hash.query(b.x, b.y, b.r + 50, this._q)) {
          if (e.dead || b.hit.has(e.id)) continue;
          const rr = b.r + e.r;
          if (U.dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;

          b.hit.add(e.id);
          const sp = Math.hypot(b.vx, b.vy);
          this.damageEnemy(e, b.damage, b.crit, b.vx / sp, b.vy / sp, 110);
          this.fx.burst(b.x, b.y, b.crit ? '#ffe066' : '#9ff8ff', 3, 120, 0.2, 2);

          if (b.pierce > 0) {
            b.pierce--;
          } else if (b.bounce > 0) {
            b.bounce--;
            const t = this.nearestEnemy(b.x, b.y, 280, b.hit);
            if (t) {
              const a = Math.atan2(t.y - b.y, t.x - b.x);
              b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
              b.life = Math.max(b.life, 0.5);
            } else b.dead = true;
          } else {
            b.dead = true;
          }
          break;
        }
      }
    }

    updateEnemyBullets(dt) {
      const p = this.player;
      for (const b of this.enemyBullets) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if ((b.life -= dt) <= 0) { b.dead = true; continue; }
        if (p.dead || p.invuln > 0 || this.godMode) continue;
        const rr = p.r + b.r - 2;
        if (U.dist2(p.x, p.y, b.x, b.y) < rr * rr) { b.dead = true; this.hurtPlayer(b.damage); }
      }
    }

    enemyShoot(x, y, angle, speed, damage, color) {
      this.enemyBullets.push(new G.EnemyBullet(x, y, angle, speed, damage, color));
      G.Audio.play('enemyShot');
    }

    collidePlayer() {
      const p = this.player;
      if (p.invuln > 0 || this.godMode) return;
      for (const e of this.hash.query(p.x, p.y, p.r + 60, this._q)) {
        if (e.dead) continue;
        const rr = p.r + e.r - 2;
        if (U.dist2(p.x, p.y, e.x, e.y) < rr * rr) { this.hurtPlayer(e.damage); return; }
      }
    }

    hurtPlayer(amount) {
      const p = this.player;
      const dmg = amount * (1 - p.stats.armor);
      p.hp -= dmg;
      p.invuln = C.PLAYER.invuln;
      p.hurtFlash = 0.25;
      this.hitStop = 0.05;
      this.fx.shake(0.45);
      this.fx.text(p.x, p.y - 26, '-' + Math.round(dmg), '#ff4060', 18);
      this.fx.burst(p.x, p.y, '#ff4060', 14, 220, 0.4, 3);
      G.Audio.play('hurt');

      // Shove nearby enemies away so a hit gives you room to escape.
      for (const e of this.hash.query(p.x, p.y, 110, this._q)) {
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1, m = e.def.mass || 1;
        e.kx += (dx / d) * 320 / m; e.ky += (dy / d) * 320 / m;
      }
      if (p.hp <= 0) { p.hp = 0; this.end(false); }
    }

    damageEnemy(e, amount, crit, dirX, dirY, knock) {
      if (e.dead) return;
      e.hp -= amount;
      e.flash = 0.07;
      if (knock) { const m = e.def.mass || 1; e.kx += (dirX * knock) / m; e.ky += (dirY * knock) / m; }
      this.fx.text(e.x + U.rand(-6, 6), e.y - e.r, Math.round(amount), crit ? '#ffe066' : '#ffffff', crit ? 17 : 12);
      G.Audio.play('hit');
      if (e.hp <= 0) this.killEnemy(e);
    }

    killEnemy(e) {
      const d = e.def;
      e.dead = true;
      this.kills++;
      this.score += d.xp * 10;
      this.fx.burst(e.x, e.y, d.color, (8 + e.r * 0.6) | 0, 160 + e.r * 4, 0.55, 3);
      this.fx.burst(e.x, e.y, '#ffffff', 3, 90, 0.25, 2);
      G.Audio.play('kill');

      if (d.xp) this.dropGem(e.x, e.y, d.xp);
      const roll = Math.random();
      if (roll < 0.012) this.pickups.push(new G.Pickup(e.x, e.y, 'heart'));
      else if (roll < 0.016) this.pickups.push(new G.Pickup(e.x, e.y, 'magnet'));

      if (d.splitInto) {
        for (let i = 0; i < d.splitCount; i++) {
          const a = (i / d.splitCount) * Math.PI * 2 + Math.random();
          const s = new G.Enemy(d.splitInto, e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, this.director.hpMul(), this);
          s.kx = Math.cos(a) * 220; s.ky = Math.sin(a) * 220;
          this.enemies.push(s);
        }
      }
      if (e === this.boss) this.onBossKilled(e);
    }

    onBossKilled(e) {
      this.boss = null;
      this.bossKills++;
      this.score += 1000;
      for (let i = 0; i < 14; i++) this.dropGem(e.x, e.y, 25);
      for (const g of this.gems) { g.sx *= 3; g.sy *= 3; }
      this.pickups.push(new G.Pickup(e.x, e.y, 'heart'));
      this.fx.burst(e.x, e.y, e.def.color, 120, 520, 1.2, 5);
      this.fx.ring(e.x, e.y, 260, '#ffd166', 0.8, 6);
      this.fx.shake(1);
      this.hitStop = 0.2;
      this.showBanner('Босс повержен!', '+1000 очков', 2.5);
      G.Audio.play('bossDie');
    }

    nova(x, y, radius, dmg) {
      this.fx.ring(x, y, radius, '#ffd166', 0.35, 4);
      this.fx.shake(0.12);
      G.Audio.play('nova');
      for (const e of this.hash.query(x, y, radius + 50, this._q)) {
        if (e.dead) continue;
        const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
        if (d > radius + e.r) continue;
        this.damageEnemy(e, dmg, false, dx / d, dy / d, 420);
      }
    }

    // ------------------------------------------------------------ pickups
    dropGem(x, y, value) {
      if (this.gems.length >= C.MAX_GEMS) {
        const g = this.gems[this.gemMergeIdx++ % this.gems.length];
        g.setValue(g.value + value);
        return;
      }
      this.gems.push(new G.Gem(x, y, value));
    }

    // Shared homing logic for gems and pickups. Returns true when collected.
    pullToward(o, dt, radius) {
      const p = this.player;
      if (p.dead) return false;
      const dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy;
      if (!o.pulled) {
        if (d2 > radius * radius) return false;
        o.pulled = true;
        o.v = -140; // tiny "pop" away before flying in
      }
      const d = Math.sqrt(d2) || 1;
      o.v = Math.min(o.v + 1800 * dt, 1100);
      const step = o.v * dt;
      if (d <= p.r + o.r + Math.max(step, 0)) return true;
      o.x += (dx / d) * step; o.y += (dy / d) * step;
      return false;
    }

    updateGems(dt) {
      const p = this.player;
      for (const g of this.gems) {
        if (!g.pulled) {
          g.x += g.sx * dt; g.y += g.sy * dt;
          const f = Math.exp(-dt * 6); g.sx *= f; g.sy *= f;
        }
        if (!this.pullToward(g, dt, p.stats.magnet)) continue;
        g.dead = true;
        p.addXp(g.value, this);
        this.gemCombo = Math.min(this.gemCombo + 1, 24);
        this.gemComboTimer = 0.5;
        G.Audio.play('gem', this.gemCombo);
      }
    }

    updatePickups(dt) {
      const p = this.player;
      for (const k of this.pickups) {
        if ((k.life -= dt) <= 0) { k.dead = true; continue; }
        if (!this.pullToward(k, dt, 60)) continue;
        k.dead = true;
        if (k.kind === 'heart') {
          p.heal(30);
          this.fx.text(p.x, p.y - 26, '+30', '#6dff9a', 18);
          G.Audio.play('heal');
        } else {
          for (const g of this.gems) if (!g.pulled) { g.pulled = true; g.v = -60; }
          this.fx.ring(p.x, p.y, Math.max(this.w, this.h), '#5ec8ff', 0.6, 3);
          this.fx.text(p.x, p.y - 26, 'МАГНИТ!', '#5ec8ff', 18);
          G.Audio.play('magnet');
        }
      }
    }

    showBanner(text, sub, dur) { this.banner = { text, sub, t: dur, dur }; }

    // ------------------------------------------------------------ rendering
    sprite(s, x, y, rot) {
      const d = this.dpr, ctx = this.ctx;
      if (rot) {
        const c = Math.cos(rot) * d, n = Math.sin(rot) * d;
        ctx.setTransform(c, n, -n, c, x * d, y * d);
      } else {
        ctx.setTransform(d, 0, 0, d, x * d, y * d);
      }
      ctx.drawImage(s.canvas, -s.half, -s.half, s.half * 2, s.half * 2);
    }

    drawGrid(ox, oy) {
      const ctx = this.ctx, w = this.w, h = this.h;
      ctx.lineWidth = 1;
      for (const [step, alpha] of [[64, 0.05], [320, 0.1]]) {
        ctx.strokeStyle = `rgba(110,120,255,${alpha})`;
        ctx.beginPath();
        for (let x = ((ox % step) + step) % step; x < w; x += step) { const X = Math.round(x) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, h); }
        for (let y = ((oy % step) + step) % step; y < h; y += step) { const Y = Math.round(y) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(w, Y); }
        ctx.stroke();
      }
    }

    render() {
      const ctx = this.ctx, d = this.dpr, w = this.w, h = this.h;
      const resetTransform = () => ctx.setTransform(d, 0, 0, d, 0, 0);
      resetTransform();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#07060f';
      ctx.fillRect(0, 0, w, h);

      if (!this.player) { this.renderMenuBackground(); return; }

      const sh = this.fx.shakeOffset();
      const ox = w / 2 - this.cam.x + sh.x, oy = h / 2 - this.cam.y + sh.y;
      this.drawGrid(ox, oy);

      // Only draw what is on screen.
      const m = 80, vx0 = -ox - m, vy0 = -oy - m, vx1 = -ox + w + m, vy1 = -oy + h + m;
      const vis = o => o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1;
      const S = G.Sprites, t = this.time, p = this.player;

      // Gems and pickups
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this.gems) {
        if (!vis(g)) continue;
        const bob = g.pulled ? 0 : Math.sin(t * 4 + g.phase) * 2;
        this.sprite(S.get('gem', g.color, g.r), g.x + ox, g.y + oy + bob, 0);
      }
      for (const k of this.pickups) {
        if (!vis(k) || (k.life < 5 && Math.floor(k.life * 8) % 2)) continue;
        const bob = Math.sin(t * 3 + k.x) * 2;
        if (k.kind === 'heart') this.sprite(S.get('plus', '#ff5a8a', 10), k.x + ox, k.y + oy + bob, 0);
        else this.sprite(S.get('hex', '#5ec8ff', 10), k.x + ox, k.y + oy + bob, t * 2);
      }

      // Enemies
      ctx.globalCompositeOperation = 'source-over';
      for (const e of this.enemies) {
        if (e.dead || !vis(e)) continue;
        const df = e.def;
        const rot = df.spin ? e.age * df.spin : (df.shape === 'triangle' || df.shape === 'diamond') ? e.angle : 0;
        ctx.globalAlpha = Math.min(1, e.age * 4);
        this.sprite(S.get(df.shape, e.flash > 0 ? '#ffffff' : df.color, df.radius), e.x + ox, e.y + oy, rot);
      }
      ctx.globalAlpha = 1;
      resetTransform();
      for (const e of this.enemies) {
        if (e.dead || !e.def.showHp || e.hp >= e.maxHp || !vis(e)) continue;
        const bw = e.r * 2, x = e.x + ox - e.r, y = e.y + oy + e.r + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, bw, 4);
        ctx.fillStyle = e.def.color; ctx.fillRect(x, y, bw * (e.hp / e.maxHp), 4);
      }

      // Player, orbiting spheres
      if (!p.dead) {
        ctx.globalCompositeOperation = 'lighter';
        for (const o of p.orbitPositions()) this.sprite(S.get('circle', '#ffd166', 9), o.x + ox, o.y + oy, 0);
        ctx.globalCompositeOperation = 'source-over';
        const blink = p.invuln > 0 && p.dashTime <= 0 && Math.floor(p.invuln * 14) % 2 === 0;
        ctx.globalAlpha = blink ? 0.35 : 1;
        // The player is the only white object on screen, so it never gets lost in the swarm.
        resetTransform();
        ctx.strokeStyle = 'rgba(127,246,255,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x + ox, p.y + oy, p.r + 9, 0, Math.PI * 2);
        ctx.stroke();
        const pc = p.hurtFlash > 0 ? '#ff4060' : '#f4fbff';
        this.sprite(S.get('circle', pc, p.r), p.x + ox, p.y + oy, 0);
        this.sprite(S.get('triangle', '#7ff6ff', 6), p.x + ox + p.faceX * (p.r + 16), p.y + oy + p.faceY * (p.r + 16), Math.atan2(p.faceY, p.faceX));
        ctx.globalAlpha = 1;
      }
      resetTransform();

      // Player bullets: a wide faint stroke for glow, then a bright core.
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const crit of [false, true]) {
        ctx.beginPath();
        for (const b of this.bullets) {
          if (b.crit !== crit) continue;
          const x = b.x + ox, y = b.y + oy;
          ctx.moveTo(x - b.vx * 0.03, y - b.vy * 0.03);
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = crit ? 'rgba(255,224,102,0.25)' : 'rgba(127,246,255,0.22)';
        ctx.lineWidth = crit ? 14 : 10;
        ctx.stroke();
        ctx.strokeStyle = crit ? '#ffe066' : '#bffbff';
        ctx.lineWidth = crit ? 5 : 3.5;
        ctx.stroke();
      }

      // Enemy bullets
      for (const b of this.enemyBullets) if (vis(b)) this.sprite(S.get('circle', b.color, b.r), b.x + ox, b.y + oy, 0);
      resetTransform();

      this.fx.draw(ctx, ox, oy);
      ctx.globalCompositeOperation = 'source-over';
      this.drawScreenEffects();
      G.drawHud(ctx, this);
    }

    drawScreenEffects() {
      const ctx = this.ctx, p = this.player, w = this.w, h = this.h;
      const frac = p.hp / p.stats.maxHp;
      if (!p.dead && frac < 0.35) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
        const a = ((0.35 - frac) / 0.35) * (0.35 + 0.25 * pulse);
        const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
        grad.addColorStop(0, 'rgba(255,30,60,0)');
        grad.addColorStop(1, `rgba(255,30,60,${a})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
      if (p.hurtFlash > 0) {
        ctx.fillStyle = `rgba(255,40,70,${p.hurtFlash * 0.6})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    renderMenuBackground() {
      const t = this.menuTime, w = this.w, h = this.h, ctx = this.ctx;
      this.drawGrid(-t * 30, -t * 18);
      const types = ['crawler', 'dart', 'brute', 'spitter', 'splitter'];
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 22; i++) {
        const df = G.ENEMIES[types[i % types.length]];
        const a = t * 0.12 + i * 0.29;
        const R = 0.38 + 0.12 * Math.sin(i * 1.7 + t * 0.3);
        this.sprite(G.Sprites.get(df.shape, df.color, df.radius), w / 2 + Math.cos(a) * R * w, h / 2 + Math.sin(a) * R * h, a * 2);
      }
      ctx.globalAlpha = 1;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  G.Game = Game;
})();
