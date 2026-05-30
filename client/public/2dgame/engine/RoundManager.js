class RoundManager {
  constructor({
    seconds,
    timerElement,
    dialogElement,
    fighters,
    onFinish = () => {},
    onRestart = () => {},
    resolveWinner = null,
  }) {
    this.initialSeconds = seconds;
    this.remainingSeconds = seconds;
    this.timerElement = timerElement;
    this.dialogElement = dialogElement;
    this.fighters = fighters;
    this.onFinish = onFinish;
    this.onRestart = onRestart;
    this.resolveWinner = resolveWinner;
    this.intervalId = null;
    this.finished = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleDialogClick = this.handleDialogClick.bind(this);
  }

  start() {
    this.renderTimer();
    window.addEventListener("keydown", this.handleKeyDown);
    this.dialogElement.addEventListener("click", this.handleDialogClick);

    this.intervalId = window.setInterval(() => {
      if (this.finished) return;

      if (this.remainingSeconds > 0) {
        this.remainingSeconds -= 1;
        this.renderTimer();
      }

      if (this.remainingSeconds === 0) {
        this.finish("timeout");
      }
    }, 1000);
  }

  destroy() {
    window.clearInterval(this.intervalId);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.dialogElement.removeEventListener("click", this.handleDialogClick);
  }

  update() {
    if (this.finished) return;

    if (this.hasKnockout()) {
      this.finish("ko");
    }
  }

  finish(reason = "timeout") {
    if (this.finished) return;

    this.finished = true;
    this.finishReason = reason;
    window.clearInterval(this.intervalId);
    const winner = this.resolveWinner?.({
      reason,
      fighters: this.fighters,
      remainingSeconds: this.remainingSeconds,
    });
    this.onFinish({ reason, winner });

    const [fighterA, fighterB] = this.fighters;
    let message = winner?.message || "Tie";

    if (!winner && fighterA.health > fighterB.health) {
      message = `${fighterA.displayName} Wins`;
    } else if (!winner && fighterB.health > fighterA.health) {
      message = `${fighterB.displayName} Wins`;
    }

    this.dialogElement.style.display = "flex";
    this.dialogElement.innerHTML = message;
  }

  hasKnockout() {
    return this.fighters.some((fighter) => this.isDefeated(fighter));
  }

  isDefeated(fighter) {
    return Number.isFinite(fighter.health) && fighter.health <= 0;
  }

  handleKeyDown(event) {
    if (!this.finished) return;

    const key = event.key.toLowerCase();
    if (key === "enter" || key === "r") {
      event.preventDefault();
      this.onRestart();
    }
  }

  handleDialogClick() {
    if (this.finished) this.onRestart();
  }

  formatRemainingTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  renderTimer() {
    this.timerElement.textContent = this.formatRemainingTime(this.remainingSeconds);
  }

  setRemainingSeconds(seconds) {
    if (this.finished) return;

    const nextSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
    if (nextSeconds === this.remainingSeconds) return;

    this.remainingSeconds = nextSeconds;
    this.renderTimer();

    if (this.remainingSeconds === 0) {
      this.finish("arena-round-end");
    }
  }
}
