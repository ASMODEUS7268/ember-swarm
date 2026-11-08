(function () {
  'use strict';
  const U = G.Utils;

  // Every sound is synthesized with WebAudio, so the game ships with zero audio files.
  G.Audio = {
    ctx: null,
    master: null,
    muted: false,
    volume: 0.35,
    lastPlayed: {},

    // Browsers only allow audio after a user gesture, so this runs on the first click/key.
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);

      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, len);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
      return this.muted;
    },

    // Stops rapid-fire sounds (hits, shots) from stacking into noise.
    throttle(name, gap) {
      const now = performance.now();
      if (now - (this.lastPlayed[name] || 0) < gap * 1000) return false;
      this.lastPlayed[name] = now;
      return true;
    },

    tone({ type = 'square', freq = 440, to = null, dur = 0.1, vol = 0.1, delay = 0 }) {
      const c = this.ctx, t0 = c.currentTime + delay;
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    noise({ dur = 0.2, vol = 0.1, from = 2000, to = 300, delay = 0 }) {
      const c = this.ctx, t0 = c.currentTime + delay;
      const src = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
      src.buffer = this.noiseBuf;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(from, t0);
      filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t0, Math.random() * 0.5);
      src.stop(t0 + dur + 0.02);
    },

    arpeggio(notes, type, step, dur, vol) {
      notes.forEach((f, i) => this.tone({ type, freq: f, dur, vol, delay: i * step }));
    },

    play(name, arg) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'shoot':
          if (this.throttle(name, 0.07)) this.tone({ freq: U.rand(820, 900), to: 420, dur: 0.05, vol: 0.035 });
          break;
        case 'hit':
          if (this.throttle(name, 0.03)) this.tone({ type: 'triangle', freq: 320, to: 140, dur: 0.05, vol: 0.06 });
          break;
        case 'kill':
          if (!this.throttle(name, 0.035)) break;
          this.noise({ dur: 0.12, vol: 0.12, from: 2400, to: 300 });
          this.tone({ type: 'sine', freq: 180, to: 60, dur: 0.1, vol: 0.08 });
          break;
        case 'gem': // pitch climbs while you keep collecting
          if (this.throttle(name, 0.025)) this.tone({ type: 'sine', freq: 520 * Math.pow(2, Math.min(arg || 0, 24) / 12), dur: 0.07, vol: 0.06 });
          break;
        case 'levelup':
          this.arpeggio([523, 659, 784, 1047], 'triangle', 0.07, 0.2, 0.12);
          break;
        case 'hurt':
          this.tone({ type: 'sawtooth', freq: 240, to: 70, dur: 0.25, vol: 0.16 });
          this.noise({ dur: 0.15, vol: 0.12, from: 1500, to: 200 });
          break;
        case 'dash':
          this.noise({ dur: 0.18, vol: 0.12, from: 3200, to: 600 });
          break;
        case 'nova':
          this.tone({ type: 'sine', freq: 160, to: 40, dur: 0.45, vol: 0.25 });
          this.noise({ dur: 0.3, vol: 0.1, from: 900, to: 100 });
          break;
        case 'enemyShot':
          if (this.throttle(name, 0.09)) this.tone({ freq: 360, to: 220, dur: 0.07, vol: 0.03 });
          break;
        case 'bossShot':
          if (this.throttle(name, 0.1)) this.tone({ type: 'sawtooth', freq: 200, to: 90, dur: 0.2, vol: 0.08 });
          break;
        case 'boss':
          this.tone({ type: 'sawtooth', freq: 90, to: 45, dur: 1.2, vol: 0.22 });
          this.tone({ freq: 60, to: 40, dur: 1.2, vol: 0.1 });
          break;
        case 'bossDie':
          this.noise({ dur: 1.0, vol: 0.3, from: 3000, to: 80 });
          this.tone({ type: 'sine', freq: 200, to: 30, dur: 1.0, vol: 0.3 });
          break;
        case 'wave':
          this.tone({ type: 'triangle', freq: 300, to: 600, dur: 0.3, vol: 0.1 });
          this.tone({ type: 'triangle', freq: 300, to: 600, dur: 0.3, vol: 0.1, delay: 0.18 });
          break;
        case 'heal':
          this.tone({ type: 'sine', freq: 440, to: 880, dur: 0.2, vol: 0.12 });
          break;
        case 'magnet':
          this.tone({ type: 'triangle', freq: 200, to: 1200, dur: 0.4, vol: 0.12 });
          break;
        case 'death':
          this.noise({ dur: 0.8, vol: 0.25, from: 2000, to: 60 });
          this.tone({ type: 'sawtooth', freq: 300, to: 40, dur: 0.9, vol: 0.18 });
          break;
        case 'victory':
          this.arpeggio([523, 659, 784, 1047, 1319, 1568], 'triangle', 0.1, 0.35, 0.13);
          break;
        case 'click':
          this.tone({ type: 'sine', freq: 700, dur: 0.04, vol: 0.05 });
          break;
      }
    },
  };
})();
