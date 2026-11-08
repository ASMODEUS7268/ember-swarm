(function () {
  'use strict';
  const U = G.Utils;

  // Data-driven upgrades: adding a new one is a single entry here.
  // `apply(stats, player)` runs once per level taken.
  G.UPGRADES = [
    { id: 'damage',   icon: '🔥', name: 'Перегрев ядра',   max: 8, desc: 'Урон всего оружия +20%', apply: s => { s.damage *= 1.2; } },
    { id: 'rate',     icon: '⚡', name: 'Скорострел',      max: 8, desc: 'Скорость стрельбы +15%', apply: s => { s.fireRate *= 1.15; } },
    { id: 'multi',    icon: '🔱', name: 'Веер',            max: 4, desc: '+1 снаряд в каждом залпе', weight: 0.8, apply: s => { s.projectiles += 1; } },
    { id: 'pierce',   icon: '🗡️', name: 'Пробой',          max: 4, desc: 'Снаряд пробивает ещё одного врага', apply: s => { s.pierce += 1; } },
    { id: 'bounce',   icon: '↯',  name: 'Рикошет',         max: 3, desc: 'Снаряд отскакивает к ближайшему врагу', apply: s => { s.bounce += 1; } },
    { id: 'crit',     icon: '🎯', name: 'Слабое место',    max: 5, desc: 'Шанс крита +10% (крит наносит ×2)', apply: s => { s.crit += 0.1; } },
    { id: 'velocity', icon: '💨', name: 'Разгон',          max: 4, desc: 'Скорость и дальность снарядов +15%', apply: s => { s.bulletSpeed *= 1.15; s.bulletLife *= 1.05; } },
    { id: 'speed',    icon: '👟', name: 'Лёгкий шаг',      max: 5, desc: 'Скорость движения +10%', apply: s => { s.moveSpeed *= 1.1; } },
    { id: 'vitality', icon: '❤️', name: 'Крепкий панцирь', max: 6, desc: 'Макс. здоровье +25 и лечение на 25', apply: (s, p) => { s.maxHp += 25; p.heal(25); } },
    { id: 'regen',    icon: '🌿', name: 'Регенерация',     max: 5, desc: '+0.5 здоровья в секунду', apply: s => { s.regen += 0.5; } },
    { id: 'armor',    icon: '🛡️', name: 'Броня',           max: 4, desc: 'Получаемый урон −8%', apply: s => { s.armor += 0.08; } },
    { id: 'magnet',   icon: '🧲', name: 'Магнит',          max: 4, desc: 'Радиус сбора опыта +35%', apply: s => { s.magnet *= 1.35; } },
    { id: 'dash',     icon: '🌀', name: 'Короткий рывок',  max: 4, desc: 'Перезарядка рывка −18%', apply: s => { s.dashCooldown *= 0.82; } },
    {
      id: 'orbit', icon: '🪐', name: 'Сателлиты', max: 5, weapon: true,
      desc: 'Две сферы кружат вокруг тебя и бьют врагов',
      descNext: '+1 сфера, урон сфер +25%',
      apply: s => {
        s.orbitCount = s.orbitCount ? s.orbitCount + 1 : 2;
        s.orbitDamage = s.orbitDamage ? s.orbitDamage * 1.25 : 14;
      },
    },
    {
      id: 'nova', icon: '💥', name: 'Импульс', max: 5, weapon: true,
      desc: 'Каждые 4 с ударная волна ранит и отбрасывает врагов',
      descNext: 'Волна чаще, сильнее и шире',
      apply: s => { s.novaLevel += 1; },
    },
  ];

  // Offered when everything else is maxed out.
  G.FALLBACK_UPGRADES = [
    { id: null, icon: '🩹', name: 'Аптечка', desc: 'Восстановить 40 здоровья', apply: (s, p) => p.heal(40) },
    { id: null, icon: '💰', name: 'Трофей',  desc: '+500 очков', apply: (s, p, g) => { g.score += 500; } },
  ];

  G.pickUpgrades = function (player, count) {
    const pool = G.UPGRADES.filter(u => (player.upgrades[u.id] || 0) < u.max);
    const out = [];
    while (out.length < count && pool.length) {
      // New weapons are slightly favoured so runs feel different from each other.
      const u = U.weightedPick(pool, u => (u.weight || 1) * (u.weapon && !player.upgrades[u.id] ? 1.4 : 1));
      out.push(u);
      pool.splice(pool.indexOf(u), 1);
    }
    for (const f of G.FALLBACK_UPGRADES) if (out.length < count) out.push(f);
    return out;
  };

  G.applyUpgrade = function (player, up, game) {
    if (up.id) player.upgrades[up.id] = (player.upgrades[up.id] || 0) + 1;
    up.apply(player.stats, player, game);
  };

  G.upgradeById = id => G.UPGRADES.find(u => u.id === id);
})();
