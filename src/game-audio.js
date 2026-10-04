// Azulejo game sound (src/game.js): small Web Audio cues, no asset files.
// The context is created on the first user gesture (browsers block audio
// otherwise) and every voice is a short envelope over one oscillator, so
// there is nothing to download and nothing to clean up. Muted until the
// player touches the map or a key.

export function createGameAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let ambient = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return ctx;
  }
  function resume() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  // One short tone: frequency sweep f0 -> f1 over `dur`, with a fast attack
  // and exponential release. type is an oscillator waveform.
  function tone(f0, f1, dur, { type = 'sine', gain = 1, delay = 0 } = {}) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  return {
    resume,
    setMuted(v) {
      muted = !!v;
    },
    get muted() {
      return muted;
    },
    // A very quiet ambient pad (two detuned sines, slow tremolo) under the
    // whole mode. Starts on the first gesture that unlocks audio.
    startAmbient() {
      const c = ensure();
      if (!c || ambient) return;
      ambient = c.createGain();
      ambient.gain.value = 0.0001;
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      filt.Q.value = 0.7;
      const a = c.createOscillator();
      a.type = 'sine';
      a.frequency.value = 110;
      const b = c.createOscillator();
      b.type = 'sine';
      b.frequency.value = 164.8; // a fifth up, slightly detuned
      b.detune.value = 6;
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.02;
      a.connect(filt).connect(ambient).connect(master);
      b.connect(filt);
      lfo.connect(lfoGain).connect(ambient.gain);
      [a, b, lfo].forEach((o) => o.start());
      ambient.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 2);
      ambient._nodes = [a, b, lfo];
    },
    stopAmbient() {
      if (!ambient || !ctx) return;
      const a = ambient;
      ambient = null;
      try {
        a.gain.cancelScheduledValues(ctx.currentTime);
        a.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        setTimeout(() => a._nodes?.forEach((o) => o.stop()), 700);
      } catch {
        // already stopped
      }
    },
    // rising pitch as a scan charges
    scan(t) {
      tone(220 + t * 520, 300 + t * 700, 0.09, { type: 'triangle', gain: 0.16 });
    },
    // the pickup: a bright two-note chime, higher with the combo
    pickup(combo = 1) {
      const k = Math.min(combo, 8);
      const base = 520 + k * 55;
      tone(base, base * 1.02, 0.16, { type: 'triangle', gain: 0.5 });
      tone(base * 1.5, base * 1.52, 0.28, { type: 'sine', gain: 0.34, delay: 0.06 });
      tone(base * 2, base * 2.02, 0.4, { type: 'sine', gain: 0.16, delay: 0.12 });
    },
    combo(level) {
      tone(660 + level * 40, 900 + level * 40, 0.12, { type: 'square', gain: 0.1 });
    },
    complete() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => tone(f, f * 1.01, 0.5, { type: 'triangle', gain: 0.3, delay: i * 0.13 }));
    },
    // a level-up arpeggio, brighter than a pickup
    levelUp() {
      [659, 880, 1109, 1319].forEach((f, i) => tone(f, f * 1.01, 0.35, { type: 'triangle', gain: 0.28, delay: i * 0.09 }));
    },
    // echo pulse: a downward sonar sweep
    echo() {
      tone(880, 220, 0.5, { type: 'sine', gain: 0.3 });
      tone(1320, 330, 0.45, { type: 'sine', gain: 0.14, delay: 0.05 });
    },
    // medal chime, pitched by rank (gold highest)
    medal(rank) {
      const base = rank === 'gold' ? 1175 : rank === 'silver' ? 988 : 784;
      tone(base, base * 1.01, 0.3, { type: 'triangle', gain: 0.22, delay: 0.18 });
    },
    // a ring through the chain: short blip, higher with the chain
    ring(chain = 1) {
      const f = 520 + Math.min(chain, 10) * 45;
      tone(f, f * 1.5, 0.12, { type: 'square', gain: 0.16 });
    },
    // the whole chain cleared
    chain() {
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, f * 1.01, 0.28, { type: 'triangle', gain: 0.24, delay: i * 0.07 }));
    },
    nudge() {
      tone(180, 120, 0.12, { type: 'sine', gain: 0.2 });
    },
  };
}
