class GameEngine {
  constructor({
    canvas,
    timerElement,
    dialogElement,
    stagePath,
    fighterPaths,
    autonomous = false,
    rootElement = null,
    assetBasePath = "",
  }) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.timerElement = timerElement;
    this.dialogElement = dialogElement;
    this.rootElement = rootElement || canvas.closest(".bantah-fighting-game") || document;
    this.stagePath = stagePath;
    this.fighterPaths = fighterPaths;
    this.autonomous = autonomous;
    this.assetBasePath = assetBasePath;

    this.stage = null;
    this.background = null;
    this.decorations = [];
    this.fighters = [];
    this.fighterConfigs = [];
    this.input = null;
    this.moveResolver = null;
    this.round = null;
    this.arenaState = null;
    this.arenaRoundKey = null;
    this.arenaCue = null;
    this.arenaRngSeed = null;
    this.rngState = this.hashSeed(autonomous ? "arena-boot" : "freeplay");
    this.pendingArenaPayload = null;
    this.animationFrameId = null;
    this.destroyed = false;
  }

  async start() {
    const [stageConfig, ...fighterConfigs] = await Promise.all([
      AssetLoader.loadJSON(this.stagePath),
      ...this.fighterPaths.map((path) => AssetLoader.loadJSON(path)),
    ]);

    const selectedStageConfig = this.selectStageConfig(stageConfig);
    this.normalizeConfigAssetPaths(selectedStageConfig);
    fighterConfigs.forEach((config) => this.normalizeConfigAssetPaths(config));

    await AssetLoader.preloadImages(
      AssetLoader.collectImageSources(selectedStageConfig, fighterConfigs),
    );

    if (this.destroyed) return;

    this.stage = selectedStageConfig;
    this.fighterConfigs = fighterConfigs;
    this.canvas.width = selectedStageConfig.canvas.width;
    this.canvas.height = selectedStageConfig.canvas.height;

    window.canvas = this.canvas;
    window.canvas2dContext = this.context;
    window.gravity = stageConfig.gravity;

    this.background = this.createSprite(selectedStageConfig.background);
    this.decorations = (selectedStageConfig.decorations || []).map((decoration) =>
      this.createSprite(decoration),
    );
    this.fighters = fighterConfigs.map((config) => this.createFighter(config));

    this.input = new InputManager(this.createBindings(fighterConfigs));
    this.moveResolver = new MoveResolver(fighterConfigs);
    this.round = this.createRoundManager();
    this.round.start();
    if (this.pendingArenaPayload) {
      this.applyArenaPayload(this.pendingArenaPayload);
      this.pendingArenaPayload = null;
    }

    this.animate();
  }

  destroy() {
    this.destroyed = true;
    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.round?.destroy();
    this.input?.destroy();
    this.queryAll(".damage-trail, .hit-spark, .damage-number").forEach((element) =>
      element.remove(),
    );
    if (window.gameEngine === this) {
      window.gameEngine = null;
    }
  }

  query(selector) {
    return this.rootElement?.querySelector?.(selector) || document.querySelector(selector);
  }

  queryAll(selector) {
    return Array.from(
      this.rootElement?.querySelectorAll?.(selector) || document.querySelectorAll(selector),
    );
  }

  normalizeConfigAssetPaths(value) {
    if (!value || typeof value !== "object") return value;

    if (Array.isArray(value)) {
      value.forEach((entry) => this.normalizeConfigAssetPaths(entry));
      return value;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (key === "imageSrc" && typeof nestedValue === "string") {
        value[key] = this.resolveAssetPath(nestedValue);
      } else {
        this.normalizeConfigAssetPaths(nestedValue);
      }
    }

    return value;
  }

  resolveAssetPath(assetPath) {
    if (
      !assetPath ||
      /^(?:[a-z]+:)?\/\//i.test(assetPath) ||
      assetPath.startsWith("/") ||
      assetPath.startsWith("data:")
    ) {
      return assetPath;
    }

    const base = this.assetBasePath ? this.assetBasePath.replace(/\/?$/, "/") : "";
    return `${base}${assetPath}`;
  }

  createSprite(config) {
    return new Sprite({
      ...this.clone(config),
      context: this.context,
      canvasElement: this.canvas,
      gravityValue: this.stage.gravity,
    });
  }

  createRoundManager() {
    return new RoundManager({
      seconds: this.stage.roundSeconds,
      timerElement: this.timerElement,
      dialogElement: this.dialogElement,
      fighters: this.fighters,
      onFinish: () => this.stopRoundActions(),
      onRestart: () => this.restartRound(),
      resolveWinner: (context) => this.resolveRoundWinner(context),
    });
  }

  selectStageConfig(stageConfig) {
    const selectedStageConfig = this.clone(stageConfig);
    const variants = [
      selectedStageConfig.background,
      ...(selectedStageConfig.backgroundVariants || []),
    ].filter((variant) => variant?.imageSrc);

    if (!this.autonomous || variants.length < 2) {
      return selectedStageConfig;
    }

    const seed = this.getInitialArenaSeed();
    const selectedIndex = this.hashSeed(`stage:${seed}`) % variants.length;
    selectedStageConfig.background = this.clone(variants[selectedIndex]);
    selectedStageConfig.selectedBackgroundId =
      selectedStageConfig.background.id || selectedStageConfig.background.imageSrc;
    return selectedStageConfig;
  }

  getInitialArenaSeed() {
    const params = new URLSearchParams(window.location.search);
    return [
      params.get("battleId"),
      params.get("round"),
      params.get("stage"),
    ]
      .filter(Boolean)
      .join(":") || "arena-preview";
  }

  createFighter(config) {
    const moves = MoveResolver.normalizeMoves(config);
    const defaultMove = moves[0] || config.attack;

    const fighter = new Fighter({
      position: this.clone(config.position),
      velocity: this.clone(config.velocity),
      offset: this.clone(config.offset),
      imageSrc: config.imageSrc,
      totalFrames: config.totalFrames,
      scale: config.scale,
      sprites: this.clone(config.sprites),
      context: this.context,
      canvasElement: this.canvas,
      gravityValue: this.stage.gravity,
      floorY: this.stage.floorY,
      movementBounds: this.stage.fighterBounds,
      bodySize: this.clone(config.bodySize),
      hurtboxes: this.clone(config.hurtboxes),
      collisionBox: this.clone(config.collisionBox),
      attackBox: {
        offset: this.clone(defaultMove.hitbox.offset),
        width: defaultMove.hitbox.width,
        height: defaultMove.hitbox.height,
      },
    });

    fighter.playerId = config.id;
    fighter.displayName = config.name;
    fighter.movement = config.movement;
    fighter.moves = moves;
    fighter.attackConfig = defaultMove;
    fighter.healthSelector = config.healthSelector;
    fighter.renderedHealth = fighter.health;
    fighter.ai = this.createDefaultAiProfile();

    return fighter;
  }

  createDefaultAiProfile() {
    return {
      aggression: 50,
      damageMultiplier: 0.22,
      speedMultiplier: 1,
      cooldownMs: 900,
      preferredRange: 142,
      nextAttackAt: 0,
      nextJumpAt: 0,
      nextRetreatAt: 0,
      retreatUntil: 0,
      burstUntil: 0,
    };
  }

  hashSeed(seed) {
    const input = String(seed || "arena");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) || 1;
  }

  random() {
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let value = this.rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  getArenaRngSeed(state) {
    return [
      state.battleId,
      state.startsAt || state.endsAt || "",
      state.left?.id || "",
      state.right?.id || "",
    ].join(":");
  }

  setArenaRngSeed(seed) {
    if (!seed || seed === this.arenaRngSeed) return false;
    this.arenaRngSeed = seed;
    this.rngState = this.hashSeed(seed);
    return true;
  }

  resetArenaAiSchedule() {
    const baseTime = this.now();
    this.fighters.forEach((fighter, index) => {
      fighter.ai = {
        ...this.createDefaultAiProfile(),
        ...fighter.ai,
        nextAttackAt: baseTime + 240 + index * 120 + this.random() * 460,
        nextJumpAt: baseTime + 1_200 + this.random() * 2_400,
        nextRetreatAt: baseTime + 900 + this.random() * 1_400,
        retreatUntil: 0,
        burstUntil: 0,
      };
    });
  }

  createBindings(fighterConfigs) {
    return fighterConfigs.reduce((bindings, fighter) => {
      bindings[fighter.id] = fighter.controls;
      return bindings;
    }, {});
  }

  animate() {
    if (this.destroyed) return;

    this.clear();
    this.background.update();

    for (const decoration of this.decorations) {
      decoration.update();
    }

    if (this.stage.overlay) {
      this.context.fillStyle = this.stage.overlay;
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    for (const fighter of this.fighters) {
      fighter.update();
    }

    this.resolveBodyCollision();

    for (const fighter of this.fighters) {
      this.applyInput(fighter);
    }

    this.resolveAttacks();
    this.round.update();

    this.animationFrameId = window.requestAnimationFrame(() => this.animate());
  }

  clear() {
    this.context.fillStyle = "black";
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  applyInput(fighter) {
    if (this.autonomous) {
      this.applyAutonomousInput(fighter);
      return;
    }

    if (!fighter.canControl() || this.round.finished) {
      fighter.velocity.x = 0;
      return;
    }

    fighter.velocity.x = 0;

    const lastHorizontal = this.input.getLastHorizontal(fighter.playerId);
    const movingLeft =
      this.input.isPressed(fighter.playerId, "left") && lastHorizontal === "left";
    const movingRight =
      this.input.isPressed(fighter.playerId, "right") && lastHorizontal === "right";

    if (movingLeft) {
      fighter.velocity.x = -fighter.movement.speed;
      fighter.setMovementState("walk");
    } else if (movingRight) {
      fighter.velocity.x = fighter.movement.speed;
      fighter.setMovementState("walk");
    } else {
      fighter.setMovementState("stand");
    }

    if (this.input.consumePress(fighter.playerId, "jump") && fighter.isGrounded()) {
      fighter.velocity.y = fighter.movement.jumpVelocity;
      fighter.setMovementState("jump");
    }

    const move = this.moveResolver.getMove(fighter, this.input);
    if (move && fighter.canStartMove()) {
      fighter.startMove(move);
    }

    if (fighter.velocity.y < 0) {
      fighter.setMovementState("jump");
    } else if (fighter.velocity.y > 0) {
      fighter.setMovementState("fall");
    }
  }

  applyAutonomousInput(fighter) {
    if (!fighter.canControl() || this.round.finished) {
      fighter.velocity.x = 0;
      return;
    }

    const target = this.getOpponent(fighter);
    if (!target || target.health <= 0) {
      fighter.velocity.x = 0;
      fighter.setMovementState("stand");
      return;
    }

    const now = this.now();
    const ownCenter = this.getFighterCenterX(fighter);
    const targetCenter = this.getFighterCenterX(target);
    const direction = targetCenter >= ownCenter ? 1 : -1;
    const distance = Math.abs(targetCenter - ownCenter);
    const ai = fighter.ai || this.createDefaultAiProfile();
    fighter.ai = ai;

    const isBursting = ai.burstUntil > now;
    const speedMultiplier = (ai.speedMultiplier || 1) * (isBursting ? 1.18 : 1);
    const speed = Math.max(1, fighter.movement.speed * speedMultiplier);
    const preferredRange = ai.preferredRange || 142;

    if (ai.retreatUntil > now) {
      fighter.velocity.x = -direction * speed * 0.65;
      fighter.setMovementState("walk");
    } else if (distance > preferredRange) {
      fighter.velocity.x = direction * speed;
      fighter.setMovementState("walk");
    } else if (distance < 55 && now >= ai.nextRetreatAt) {
      ai.retreatUntil = now + 260;
      ai.nextRetreatAt = now + 1_700 + this.random() * 1_000;
      fighter.velocity.x = -direction * speed * 0.65;
      fighter.setMovementState("walk");
    } else {
      fighter.velocity.x = 0;
      fighter.setMovementState("stand");
    }

    if (distance <= preferredRange + 36 && now >= ai.nextAttackAt) {
      const move = this.chooseAutonomousMove(fighter, distance);
      if (move && fighter.startMove(move)) {
        const aggressionDelay = Math.max(0, 50 - (ai.aggression || 50)) * 8;
        ai.nextAttackAt = now + (ai.cooldownMs || 900) + aggressionDelay + this.random() * 260;
      }
    }

    if (fighter.isGrounded() && now >= ai.nextJumpAt && this.random() < 0.0025) {
      fighter.velocity.y = fighter.movement.jumpVelocity * 0.82;
      fighter.setMovementState("jump");
      ai.nextJumpAt = now + 2_600 + this.random() * 2_400;
    }
  }

  chooseAutonomousMove(fighter, distance) {
    const moves = fighter.moves || [];
    const forward = moves.find((move) => move.id === "forward_strike");
    const basic = moves.find((move) => move.id === "standing_punch") || moves[0];
    if (distance > 95 && forward) return forward;
    return basic;
  }

  getOpponent(fighter) {
    return this.fighters.find((candidate) => candidate !== fighter) || null;
  }

  getFighterCenterX(fighter) {
    const box = fighter.getCollisionBox();
    return box.position.x + box.width / 2;
  }

  now() {
    return window.performance?.now() || Date.now();
  }

  resolveBodyCollision() {
    for (let i = 0; i < this.fighters.length; i++) {
      for (let j = i + 1; j < this.fighters.length; j++) {
        CollisionSystem.resolveBodyCollision(this.fighters[i], this.fighters[j]);
      }
    }
  }

  resolveAttacks() {
    if (this.round.finished) return;

    for (const attacker of this.fighters) {
      if (!attacker.isAttacking) continue;

      const move = attacker.activeMove || attacker.attackConfig;
      const hitFrame = move.hitFrame;
      const isHitFrame = attacker.currentFrame === hitFrame;

      if (!isHitFrame) continue;

      const defender = this.fighters.find((fighter) => fighter !== attacker);
      if (
        defender &&
        !defender.dead &&
        defender.health > 0 &&
        CollisionSystem.attackOverlapsDefender(attacker, defender)
      ) {
        const damage = Math.max(
          1,
          Math.round(move.damage * (attacker.ai?.damageMultiplier || 1)),
        );
        defender.takeHit(damage);
        this.preventPrematureArenaKnockout(defender);
        this.updateHealthBar(defender);
      }

      attacker.isAttacking = false;
      attacker.activeMove = null;
    }
  }

  stopRoundActions() {
    for (const fighter of this.fighters) {
      fighter.stopActions({ idle: fighter.health > 0 });
    }
  }

  restartRound() {
    if (!this.stage || this.fighterConfigs.length < 2) return;

    this.round?.destroy();
    this.dialogElement.style.display = "none";
    this.dialogElement.innerHTML = "";
    this.queryAll(".damage-trail, .hit-spark, .damage-number").forEach((element) =>
      element.remove(),
    );

    this.fighters = this.fighterConfigs.map((config) => this.createFighter(config));
    this.round = this.createRoundManager();
    this.round.start();

    for (const fighter of this.fighters) {
      this.updateHealthBar(fighter);
    }

    if (this.arenaState) {
      this.applyArenaHud(this.arenaState);
      this.resetArenaAiSchedule();
      this.applyArenaClock(this.arenaState);
    }
  }

  preventPrematureArenaKnockout(defender) {
    if (!this.autonomous || !this.arenaState || !this.round || this.round.remainingSeconds <= 2) {
      return;
    }
    if (defender.health > 0) return;

    defender.health = 8 + this.random() * 8;
    defender.dead = false;
    defender.setState("hitstun", { force: true });
  }

  applyArenaPayload(payload = {}) {
    const state = payload.state || payload;
    if (!state?.battleId) return;

    if (!this.round || this.fighters.length < 2) {
      this.pendingArenaPayload = payload;
      return;
    }

    const nextRoundKey = `${state.battleId}:${state.startsAt || state.endsAt || ""}`;
    const previousRoundKey = this.arenaRoundKey;
    const rngSeed = this.getArenaRngSeed(state);
    const rngSeedChanged = this.setArenaRngSeed(rngSeed);
    this.autonomous = true;
    this.arenaState = state;
    this.arenaRoundKey = nextRoundKey;
    this.arenaCue = payload.cue || null;

    if (previousRoundKey && previousRoundKey !== nextRoundKey) {
      this.restartRound();
    }

    this.applyArenaHud(state);
    if (rngSeedChanged) {
      this.resetArenaAiSchedule();
    }
    this.applyArenaClock(state);
    this.applyArenaCue(payload.cue);
  }

  applyArenaHud(state) {
    const sideStates = [state.left, state.right];
    sideStates.forEach((side, index) => {
      const fighter = this.fighters[index];
      if (!fighter || !side) return;

      fighter.displayName = side.agentName || side.label || fighter.displayName;
      fighter.arenaSideId = side.id;
      fighter.ai = {
        ...this.createDefaultAiProfile(),
        ...fighter.ai,
        aggression: side.confidence,
        damageMultiplier: 0.16 + (side.confidence / 100) * 0.14,
        speedMultiplier: 0.88 + (side.confidence / 100) * 0.28,
        cooldownMs: Math.max(620, 1_060 - side.confidence * 4),
        preferredRange: 132 + Math.max(0, side.confidence - 50) * 0.35,
      };

      const root = this.query(`.player${index + 1}`);
      const name = root?.querySelector(".player-name");
      const team = root?.querySelector(".player-team");
      const avatar = root?.querySelector(".avatar-ring img");

      if (name) name.textContent = fighter.displayName;
      if (team) team.textContent = side.label || side.chainLabel || "BOTA ARENA";
      if (avatar && (side.avatarUrl || side.logoUrl)) avatar.src = side.avatarUrl || side.logoUrl;
    });
  }

  applyArenaClock(state) {
    const remaining = Number(state.timeRemainingSeconds);
    if (Number.isFinite(remaining)) {
      this.round.setRemainingSeconds(remaining);
    }
  }

  applyArenaCue(cue) {
    if (!cue?.attackerSideId) return;
    const attacker = this.fighters.find((fighter) => fighter.arenaSideId === cue.attackerSideId);
    if (!attacker?.ai) return;

    attacker.ai.burstUntil = this.now() + 1_600;
    attacker.ai.nextAttackAt = Math.min(attacker.ai.nextAttackAt || 0, this.now() + 180);
  }

  resolveRoundWinner({ reason, fighters }) {
    if (this.autonomous && this.arenaState?.leadingSideId) {
      const winner = fighters.find((fighter) => fighter.arenaSideId === this.arenaState.leadingSideId);
      if (winner) {
        return {
          fighter: winner,
          message: `${winner.displayName} Wins`,
        };
      }
    }

    return null;
  }

  updateHealthBar(fighter) {
    const healthElement = this.query(fighter.healthSelector);
    if (!healthElement) return;

    const wrapper = healthElement.closest(".health-frame") || healthElement.parentElement;
    const playerCard = healthElement.closest(".player-card");
    const hpCurrentElement = playerCard?.querySelector(".hp-current");
    const previousHealth = Math.max(fighter.renderedHealth ?? 100, 0);
    const nextHealth = Math.max(fighter.health, 0);
    const width = `${nextHealth}%`;

    if (hpCurrentElement) {
      hpCurrentElement.textContent = Math.round(nextHealth);
    }

    if (wrapper && previousHealth > nextHealth) {
      this.playHealthHitEffect(wrapper, previousHealth, nextHealth);
    }

    if (window.gsap) {
      window.gsap.killTweensOf(healthElement);
      window.gsap.to(healthElement, {
        width,
        duration: 0.16,
        ease: "power2.out",
      });
    } else {
      healthElement.style.width = width;
    }

    fighter.renderedHealth = nextHealth;
  }

  playHealthHitEffect(wrapper, previousHealth, nextHealth) {
    const damageTrail = this.ensureHealthEffectElement(wrapper, "damage-trail");
    const hitSpark = this.ensureHealthEffectElement(wrapper, "hit-spark");
    const isPlayerOne = wrapper.closest(".player1");
    const sparkPosition = isPlayerOne ? 100 - nextHealth : nextHealth;
    const damageAmount = Math.round(previousHealth - nextHealth);

    wrapper.classList.remove("is-hit");
    hitSpark.classList.remove("is-active");
    void wrapper.offsetWidth;

    wrapper.classList.add("is-hit");
    window.setTimeout(() => wrapper.classList.remove("is-hit"), 260);

    damageTrail.style.width = `${previousHealth}%`;
    damageTrail.style.opacity = "1";
    hitSpark.style.left = `${sparkPosition}%`;
    hitSpark.classList.add("is-active");
    window.setTimeout(() => hitSpark.classList.remove("is-active"), 340);
    this.spawnDamageNumber(wrapper, sparkPosition, damageAmount);

    if (window.gsap) {
      window.gsap.killTweensOf(damageTrail);
      window.gsap.fromTo(
        damageTrail,
        { width: `${previousHealth}%`, opacity: 1 },
        {
          width: `${nextHealth}%`,
          opacity: 0.88,
          delay: 0.18,
          duration: 0.48,
          ease: "power3.out",
        },
      );
    } else {
      window.setTimeout(() => {
        damageTrail.style.transition = "width 480ms ease, opacity 480ms ease";
        damageTrail.style.width = `${nextHealth}%`;
        damageTrail.style.opacity = "0.88";
      }, 180);
    }
  }

  spawnDamageNumber(wrapper, position, damageAmount) {
    if (damageAmount <= 0) return;

    const number = document.createElement("div");
    number.className = "damage-number";
    number.textContent = `-${damageAmount}`;
    number.style.left = `${position}%`;
    wrapper.appendChild(number);

    window.setTimeout(() => number.remove(), 820);
  }

  ensureHealthEffectElement(wrapper, className) {
    let element = wrapper.querySelector(`.${className}`);
    if (!element) {
      element = document.createElement("div");
      element.className = className;
      wrapper.insertBefore(element, wrapper.querySelector(".health"));
    }

    return element;
  }

  clone(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
  }
}

window.GameEngine = GameEngine;
