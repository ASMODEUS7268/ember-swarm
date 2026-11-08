(function () {
  'use strict';
  const U = G.Utils;
  const $ = sel => document.querySelector(sel);

  // DOM overlays (menus, cards). The game world and HUD are drawn on the canvas.
  class UI {
    constructor(game) {
      this.g = game;
      this.screens = { menu: $('#menu'), levelup: $('#levelup'), pause: $('#pause'), over: $('#gameover') };
      this.openedAt = 0;

      const on = (sel, fn) => $(sel).addEventListener('click', e => {
        e.currentTarget.blur();
        G.Audio.init();
        G.Audio.play('click');
        fn();
      });
      on('#btn-start', () => game.start());
      on('#btn-resume', () => game.resume());
      on('#btn-restart', () => game.start());
      on('#btn-menu', () => game.toMenu());
      on('#btn-again', () => game.start());
      on('#btn-menu2', () => game.toMenu());
      on('#btn-sound', () => this.updateMute(G.Audio.toggleMute()));
    }

    show(name) {
      for (const [key, el] of Object.entries(this.screens)) el.classList.toggle('hidden', key !== name);
    }

    hideAll() { this.show(null); }

    updateMute(muted) { $('#btn-sound').textContent = muted ? '🔇 Звук выкл (M)' : '🔊 Звук вкл (M)'; }

    showMenu() {
      const b = this.g.best;
      $('#best').innerHTML = b.score
        ? `Рекорд: <b>${b.score}</b> · лучшее время <b>${U.formatTime(b.time)}</b>`
        : 'Рекорда пока нет — самое время поставить';
      this.show('menu');
    }

    // Ignore picks for a moment so a mouse click or key mashed during combat
    // doesn't choose a card the player hasn't read.
    canPick() { return performance.now() - this.openedAt > 350; }

    showLevelUp(choices, player) {
      const box = $('#cards');
      box.innerHTML = '';
      choices.forEach((u, i) => {
        const lvl = u.id ? player.upgrades[u.id] || 0 : 0;
        const tag = !u.id ? 'Бонус' : lvl ? `Ур. ${lvl} → ${lvl + 1}` : 'Новое';
        const card = document.createElement('button');
        card.className = 'card' + (u.weapon && !lvl ? ' card-weapon' : '');
        card.style.animationDelay = i * 70 + 'ms';
        card.innerHTML = `
          <span class="card-key">${i + 1}</span>
          <span class="card-icon">${u.icon}</span>
          <span class="card-name">${u.name}</span>
          <span class="card-tag">${tag}</span>
          <span class="card-desc">${lvl && u.descNext ? u.descNext : u.desc}</span>`;
        card.addEventListener('click', () => this.g.chooseUpgrade(i));
        box.appendChild(card);
      });
      // Several level-ups can queue at once; show the level this card is for.
      $('#levelup-title').textContent = `Уровень ${player.level - this.g.pendingLevelUps + 1}!`;
      this.openedAt = performance.now();
      this.show('levelup');
    }

    buildHtml(player) {
      return Object.entries(player.upgrades)
        .map(([id, lvl]) => {
          const u = G.upgradeById(id);
          return `<span class="chip" title="${u.desc}">${u.icon} ${u.name} <b>${lvl}</b></span>`;
        })
        .join('');
    }

    showPause(player) {
      $('#pause-build').innerHTML = this.buildHtml(player) || '<span class="muted">Улучшений пока нет</span>';
      this.show('pause');
    }

    showGameOver(r) {
      $('#go-title').textContent = r.victory ? 'Победа!' : 'Рой победил';
      $('#go-title').className = r.victory ? 'win' : 'lose';
      $('#go-sub').textContent = r.victory
        ? 'Ты продержался до конца и одолел всех боссов.'
        : 'Попробуй другую сборку: каждое улучшение меняет стиль игры.';
      const stat = (label, value) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`;
      $('#go-stats').innerHTML =
        stat('Счёт', r.score + (r.isRecord ? ' <em>рекорд!</em>' : '')) +
        stat('Время', U.formatTime(r.time)) +
        stat('Убито', r.kills) +
        stat('Уровень', r.level) +
        stat('Боссы', `${r.bossKills} / ${G.CONFIG.BOSS_TIMES.length}`) +
        stat('Лучший счёт', r.best.score);
      $('#go-build').innerHTML = this.buildHtml(r.player);
      this.show('over');
    }
  }

  G.UI = UI;
})();
