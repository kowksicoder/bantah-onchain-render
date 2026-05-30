class InputManager {
  constructor(bindings, { commandBufferMs = 900 } = {}) {
    this.bindings = bindings;
    this.commandBufferMs = commandBufferMs;
    this.pressedKeys = new Set();
    this.justPressedActions = new Set();
    this.lastHorizontalAction = new Map();
    this.commandHistory = new Map();

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  onKeyDown(event) {
    const matches = this.getMatchesForKey(event.key);
    if (matches.length === 0) return;

    event.preventDefault();

    const wasPressed = this.pressedKeys.has(event.key);
    this.pressedKeys.add(event.key);

    for (const match of matches) {
      if (!wasPressed) {
        this.justPressedActions.add(this.actionKey(match.fighterId, match.action));
        this.recordAction(match.fighterId, match.action);
      }

      if (match.action === "left" || match.action === "right") {
        this.lastHorizontalAction.set(match.fighterId, match.action);
      }
    }
  }

  onKeyUp(event) {
    const matches = this.getMatchesForKey(event.key);
    if (matches.length === 0) return;

    event.preventDefault();
    this.pressedKeys.delete(event.key);
  }

  isPressed(fighterId, action) {
    const keys = this.bindings[fighterId]?.[action] || [];
    return keys.some((key) => this.pressedKeys.has(key));
  }

  consumePress(fighterId, action) {
    const key = this.actionKey(fighterId, action);
    if (!this.justPressedActions.has(key)) return false;

    this.justPressedActions.delete(key);
    return true;
  }

  consumeSequence(fighterId, actions, maxAgeMs = this.commandBufferMs) {
    if (!Array.isArray(actions) || actions.length === 0) return false;
    if (actions.length === 1) return this.consumePress(fighterId, actions[0]);

    const now = this.now();
    const history = this.getRecentHistory(fighterId, now, maxAgeMs);
    let actionIndex = actions.length - 1;

    for (let i = history.length - 1; i >= 0 && actionIndex >= 0; i--) {
      if (history[i].action === actions[actionIndex]) {
        actionIndex--;
      }
    }

    if (actionIndex >= 0) return false;

    const lastMatchedTime = history[history.length - 1].time;
    this.commandHistory.set(
      fighterId,
      (this.commandHistory.get(fighterId) || []).filter(
        (entry) => entry.time > lastMatchedTime,
      ),
    );

    return true;
  }

  getLastHorizontal(fighterId) {
    return this.lastHorizontalAction.get(fighterId);
  }

  getMatchesForKey(key) {
    const matches = [];

    for (const [fighterId, fighterBindings] of Object.entries(this.bindings)) {
      for (const [action, keys] of Object.entries(fighterBindings)) {
        if (keys.includes(key)) {
          matches.push({ fighterId, action });
        }
      }
    }

    return matches;
  }

  recordAction(fighterId, action) {
    const now = this.now();
    const history = this.commandHistory.get(fighterId) || [];

    history.push({ action, time: now });
    this.commandHistory.set(
      fighterId,
      history.filter((entry) => now - entry.time <= this.commandBufferMs),
    );
  }

  getRecentHistory(fighterId, now, maxAgeMs) {
    const history = this.commandHistory.get(fighterId) || [];
    const recentHistory = history.filter((entry) => now - entry.time <= maxAgeMs);
    this.commandHistory.set(fighterId, recentHistory);
    return recentHistory;
  }

  actionKey(fighterId, action) {
    return `${fighterId}:${action}`;
  }

  now() {
    return window.performance?.now() || Date.now();
  }
}
