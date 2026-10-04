// Azulejo game progress (src/game.js). A tiny localStorage save: which
// shards are found, the best score and the best combo. Keyed per city, so
// Braga and Guimarães keep separate panels. Storage may be blocked; every
// access is guarded and falls back to an in-memory copy for the page.

const KEY = (city) => `braga-game-${city || 'braga'}`;

export function createGameProgress(city) {
  let memory = null;
  const empty = () => ({ found: {}, score: 0, best: 0, bestCombo: 0 });
  function read() {
    if (memory) return memory;
    try {
      const raw = localStorage.getItem(KEY(city));
      memory = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
    } catch {
      memory = empty();
    }
    if (!memory.found || typeof memory.found !== 'object') memory.found = {};
    return memory;
  }
  function write() {
    try {
      localStorage.setItem(KEY(city), JSON.stringify(memory));
    } catch {
      // storage blocked: memory keeps the session's progress
    }
  }
  return {
    get state() {
      return read();
    },
    has(id) {
      return !!read().found[id];
    },
    reset() {
      memory = empty();
      write();
      return memory;
    },
    markFound(id) {
      read().found[id] = 1;
      write();
    },
    setScore(score, combo) {
      const s = read();
      s.score = score;
      if (score > s.best) s.best = score;
      if (combo > s.bestCombo) s.bestCombo = combo;
      write();
    },
  };
}
