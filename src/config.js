// All balance numbers live here, so tuning the game never means digging through logic.
window.G = window.G || {};

G.CONFIG = {
  RUN_DURATION: 600,             // survive this many seconds (and beat the last boss) to win
  BOSS_TIMES: [180, 360, 540],
  WAVE_INTERVAL: 50,             // a ring of enemies surrounds the player this often
  MAX_ENEMIES: 420,
  MAX_GEMS: 350,                 // above this, new XP merges into existing gems

  PLAYER: {
    radius: 14,
    maxHp: 100,
    moveSpeed: 200,
    invuln: 0.7,                 // seconds of invulnerability after a hit
    dashSpeed: 760,
    dashTime: 0.15,
    dashCooldown: 1.8,
    magnet: 95,
  },

  WEAPON: {
    damage: 12,
    fireRate: 2.8,               // volleys per second
    bulletSpeed: 600,
    bulletLife: 0.85,
    bulletRadius: 5,
    spread: 0.16,                // radians between projectiles in one volley
    crit: 0.05,
    critMult: 2,
  },

  SPAWN: {
    base: 1.1,                   // enemies per second at 0:00
    perMinute: 1.0,              // added to the rate for every elapsed minute
    hpPerMinute: 0.22,           // enemy HP multiplier growth per minute
    bossSlowdown: 0.45,          // spawn rate multiplier while a boss is alive
  },
};

// weight: how often it spawns; growth: how fast that weight rises after unlock.
G.ENEMIES = {
  crawler:  { shape: 'circle',   color: '#ff4f7b', radius: 12, hp: 18,   speed: 80,  damage: 10, xp: 1, weight: 10,  growth: 0, unlockAt: 0 },
  dart:     { shape: 'triangle', color: '#ffae42', radius: 10, hp: 9,    speed: 160, damage: 8,  xp: 1, weight: 5,   unlockAt: 35 },
  brute:    { shape: 'square',   color: '#b46cff', radius: 22, hp: 120,  speed: 52,  damage: 22, xp: 5, weight: 2,   unlockAt: 90, mass: 4, showHp: true, spin: 0.6 },
  spitter:  { shape: 'diamond',  color: '#3ff0c8', radius: 13, hp: 32,   speed: 75,  damage: 10, xp: 3, weight: 2.5, unlockAt: 130, behavior: 'ranged' },
  splitter: { shape: 'hex',      color: '#5ec8ff', radius: 17, hp: 48,   speed: 68,  damage: 12, xp: 2, weight: 2.5, unlockAt: 210, splitInto: 'shard', splitCount: 3, spin: 1.2 },
  shard:    { shape: 'triangle', color: '#9fe3ff', radius: 8,  hp: 8,    speed: 150, damage: 6,  xp: 1, weight: 0,   unlockAt: Infinity },
  boss:     { shape: 'star',     color: '#ff3355', radius: 46, hp: 1000, speed: 80,  damage: 30, xp: 0, weight: 0,   unlockAt: Infinity, mass: 25, behavior: 'boss', spin: 0.4 },
};

G.BOSS_NAMES = ['Матка Роя', 'Ржавый Колосс', 'Королева Углей'];
