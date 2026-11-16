// History route progress (src/quest.js). A small localStorage save, keyed
// per city like the Azulejo save (game-progress.js): which stops were
// visited and which option was picked at each stop. An answer is final:
// the first pick stays until «Start again» (reset). Storage may be blocked;
// every access is guarded and falls back to an in-memory copy for the page.

const KEY = (city) => `braga-quest-${city || 'braga'}`;

export function createQuestProgress(city) {
  let memory = null;
  const empty = () => ({ visited: {}, answers: {} });
  function read() {
    if (memory) return memory;
    try {
      const raw = localStorage.getItem(KEY(city));
      memory = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
    } catch {
      memory = empty();
    }
    for (const k of ['visited', 'answers']) if (!memory[k] || typeof memory[k] !== 'object') memory[k] = {};
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
    visited(id) {
      return !!read().visited[id];
    },
    // the picked option index, or null before an answer
    answer(id) {
      const a = read().answers[id];
      return Number.isInteger(a) ? a : null;
    },
    visit(id) {
      if (read().visited[id]) return;
      memory.visited[id] = 1;
      write();
    },
    // returns false when the stop was already answered (the first pick stays)
    pick(id, option) {
      if (this.answer(id) != null || !Number.isInteger(option)) return false;
      memory.answers[id] = option;
      write();
      return true;
    },
    reset() {
      memory = empty();
      write();
      return memory;
    },
  };
}

// stops: [{ id, answer }]. next: index of the first stop without an
// answer (stops.length when all are answered).
export function questSummary(stops, progress) {
  let right = 0;
  let answered = 0;
  let next = -1;
  stops.forEach((s, i) => {
    const a = progress.answer(s.id);
    if (a == null) {
      if (next < 0) next = i;
      return;
    }
    answered++;
    if (a === s.answer) right++;
  });
  return { right, answered, total: stops.length, next: next < 0 ? stops.length : next };
}
