class Sprite {
  // Just handle the basic animation render.
  constructor({
    position,
    mirror = false,
    offset = { x: 0, y: 0 },
    imageSrc,
    scale = 1,
    totalFrames = 1,
    context = canvas2dContext,
    canvasElement = canvas,
    gravityValue = gravity,
    floorY = null,
    movementBounds = null,
  }) {
    this.position = position;
    this.mirror = mirror;
    this.height = 150;
    this.width = 50;
    this.image = new Image();
    this.image.src = imageSrc;
    this.scale = scale;
    this.totalFrames = totalFrames;
    this.currentFrame = 0;
    this.framesElapsed = 0;
    this.framesHold = 5;
    this.offset = offset;
    this.context = context;
    this.canvas = canvasElement;
    this.gravity = gravityValue;
    this.floorY = floorY;
    this.movementBounds = movementBounds;
  }

  draw() {
    this.context.drawImage(
      this.image,
      this.currentFrame * (this.image.width / this.totalFrames),
      0,
      this.image.width / this.totalFrames,
      this.image.height,
      this.position.x - this.offset.x,
      this.position.y - this.offset.y,
      (this.image.width / this.totalFrames) * this.scale,
      this.image.height * this.scale,
    );
  }

  animateFrames() {
    this.framesElapsed++;
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.currentFrame < this.totalFrames - 1) {
        this.currentFrame++;
      } else {
        this.currentFrame = 0;
      }
    }
  }

  update() {
    this.draw();
    this.animateFrames();
  }
}

class Fighter extends Sprite {
  constructor({
    position,
    mirror = false,
    velocity,
    color = "red",
    offset = { x: 0, y: 0 },
    imageSrc,
    scale = 1,
    totalFrames = 1,
    sprites,
    context = canvas2dContext,
    canvasElement = canvas,
    gravityValue = gravity,
    floorY = null,
    movementBounds = null,
    bodySize = null,
    hurtboxes = null,
    collisionBox = null,
    attackBox = {
      offset: {},
      width: undefined,
      height: undefined,
    },
  }) {
    // Call the constructor of the parent class
    super({
      position,
      mirror,
      offset,
      imageSrc,
      scale,
      totalFrames,
      context,
      canvasElement,
      gravityValue,
      floorY,
      movementBounds,
    });

    this.velocity = velocity;
    this.color = color;
    this.height = bodySize?.height || 150;
    this.width = bodySize?.width || 50;
    this.lastKey;
    this.health = 100;
    this.dead = false;

    this.state = "stand";
    this.stateSprites = {
      stand: "idle",
      walk: "run",
      jump: "jump",
      fall: "fall",
      attack: "attack",
      hitstun: "takeHit",
      knockdown: "takeHit",
      dead: "death",
      roundover: "idle",
    };

    this.isAttacking = false;
    this.activeMove = null;
    this.activeHitIds = new Set();
    this.attackBox = {
      position: {
        x: this.position.x,
        y: this.position.y,
      },
      offset: attackBox.offset,
      width: attackBox.width,
      height: attackBox.height,
    };

    const defaultBodyBox = {
      offset: { x: 0, y: 0 },
      width: this.width,
      height: this.height,
    };
    this.hurtboxes = this.normalizeBoxes(hurtboxes, defaultBodyBox);
    this.collisionBox = this.normalizeBox(collisionBox, defaultBodyBox);

    this.currentFrame = 0;
    this.framesElapsed = 0;
    this.framesHold = 5;
    this.sprites = sprites;

    for (const sprite in this.sprites) {
      sprites[sprite].image = new Image();
      sprites[sprite].image.src = sprites[sprite].imageSrc;
    }
  }

  update() {
    this.draw();
    if (!this.dead) {
      this.animateFrames();
    }

    this.updateAttackBox();

    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.clampToStage();

    // Fitting to the ground and gravity feature.
    const floorY = this.floorY ?? this.canvas.height - this.height;
    if (this.position.y + this.velocity.y >= floorY) {
      this.velocity.y = 0;
      this.position.y = floorY;
    } else {
      this.velocity.y += this.gravity;
    }
  }

  animateFrames() {
    this.framesElapsed++;
    if (this.framesElapsed % this.framesHold !== 0) return;

    if (this.currentFrame < this.totalFrames - 1) {
      this.currentFrame++;
      return;
    }

    this.onAnimationComplete();
  }

  onAnimationComplete() {
    if (this.state === "dead") {
      this.dead = true;
      return;
    }

    if (this.state === "attack") {
      this.isAttacking = false;
      this.activeMove = null;
      this.activeHitIds.clear();
      this.setState(this.isGrounded() ? "stand" : "fall", { force: true });
      return;
    }

    if (this.state === "hitstun" || this.state === "knockdown") {
      this.setState(this.isGrounded() ? "stand" : "fall", { force: true });
      return;
    }

    this.currentFrame = 0;
  }

  attack(move = this.attackConfig) {
    this.startMove(move);
  }

  startMove(move) {
    if (!move || !this.canStartMove()) return false;

    this.activeMove = move;
    this.activeHitIds.clear();
    this.isAttacking = true;
    this.applyMoveHitbox(move);
    this.setState("attack", { force: true });
    return true;
  }

  takeHit(damage = 20) {
    if (this.state === "dead" || this.state === "roundover") return;

    this.activeMove = null;
    this.activeHitIds.clear();
    this.isAttacking = false;
    this.health = Math.max(0, this.health - damage);

    if (this.health <= 0) {
      this.setState("dead", { force: true });
    } else {
      this.setState("hitstun", { force: true });
    }
  }

  stopActions({ idle = true } = {}) {
    this.velocity.x = 0;
    this.isAttacking = false;
    this.activeMove = null;
    this.activeHitIds.clear();

    if (this.health <= 0 || this.dead) {
      this.setState("dead", { force: true });
      return;
    }

    this.setState("roundover", { force: true });
    if (idle) {
      this.forceSprite("idle", { reset: true });
    }
  }

  canStartMove() {
    return this.canControl();
  }

  canControl() {
    return ![
      "attack",
      "hitstun",
      "knockdown",
      "dead",
      "roundover",
    ].includes(this.state);
  }

  setMovementState(nextState) {
    if (!this.canControl()) return false;
    return this.setState(nextState);
  }

  setState(nextState, { force = false } = {}) {
    if (!force && !this.canTransitionTo(nextState)) return false;
    if (this.state === nextState && !force) return true;

    this.state = nextState;
    const sprite = this.stateSprites[nextState] || "idle";
    this.forceSprite(sprite, { reset: true });
    return true;
  }

  canTransitionTo(nextState) {
    if (nextState === "dead" || nextState === "roundover") return true;
    if (this.state === "dead" || this.state === "roundover") return false;
    if (nextState === "hitstun" || nextState === "knockdown") return true;
    return this.canControl();
  }

  isGrounded() {
    const floorY = this.floorY ?? this.canvas.height - this.height;
    return this.position.y >= floorY - 0.5 && this.velocity.y === 0;
  }

  applyMoveHitbox(move) {
    const hitbox = this.getLocalMoveHitboxes(move)[0];
    if (!hitbox) return;

    this.attackBox.offset = hitbox.offset;
    this.attackBox.width = hitbox.width;
    this.attackBox.height = hitbox.height;
    this.updateAttackBox();
  }

  updateAttackBox() {
    const hitbox = this.getLocalMoveHitboxes(this.activeMove)[0] || this.attackBox;
    this.attackBox.position.x = this.position.x + (hitbox.offset?.x || 0);
    this.attackBox.position.y = this.position.y + (hitbox.offset?.y || 0);
    this.attackBox.width = hitbox.width;
    this.attackBox.height = hitbox.height;
  }

  getHitBoxes() {
    if (!this.isAttacking || !this.activeMove) return [];
    if (this.currentFrame !== this.activeMove.hitFrame) return [];

    return this.getLocalMoveHitboxes(this.activeMove).map((box) =>
      this.getWorldBox(box),
    );
  }

  getHurtBoxes() {
    if (this.health <= 0 || this.state === "dead") return [];
    return this.hurtboxes.map((box) => this.getWorldBox(box));
  }

  getCollisionBox() {
    return this.getWorldBox(this.collisionBox);
  }

  getLocalMoveHitboxes(move) {
    if (!move) return [];
    if (Array.isArray(move.hitboxes)) return move.hitboxes;
    if (move.hitbox) return [move.hitbox];
    return [];
  }

  getWorldBox(box) {
    return {
      position: {
        x: this.position.x + (box.offset?.x || 0),
        y: this.position.y + (box.offset?.y || 0),
      },
      width: box.width,
      height: box.height,
    };
  }

  normalizeBoxes(boxes, fallback) {
    const source = boxes || [fallback];
    return (Array.isArray(source) ? source : [source]).map((box) =>
      this.normalizeBox(box, fallback),
    );
  }

  normalizeBox(box, fallback) {
    return {
      offset: {
        x: box?.offset?.x ?? fallback.offset.x,
        y: box?.offset?.y ?? fallback.offset.y,
      },
      width: box?.width ?? fallback.width,
      height: box?.height ?? fallback.height,
    };
  }

  clampToStage() {
    const left = this.movementBounds?.left ?? 0;
    const right = this.movementBounds?.right ?? this.canvas.width;
    this.position.x = Math.min(
      Math.max(this.position.x, left),
      right - this.width,
    );
  }

  forceSprite(sprite, { reset = false } = {}) {
    const spriteConfig = this.sprites?.[sprite];
    if (!spriteConfig) return;
    if (this.image === spriteConfig.image && !reset) return;

    this.image = spriteConfig.image;
    this.totalFrames = spriteConfig.totalFrames;
    this.currentFrame = 0;
    this.framesElapsed = 0;
  }

  switchSprite(sprite) {
    const state = Object.entries(this.stateSprites).find(
      ([, stateSprite]) => stateSprite === sprite,
    )?.[0];

    if (state) {
      this.setState(state);
    }
  }
}
