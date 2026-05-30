class MoveResolver {
  constructor(fighterConfigs) {
    this.movesByFighter = new Map(
      fighterConfigs.map((fighter) => [fighter.id, MoveResolver.normalizeMoves(fighter)]),
    );
  }

  static normalizeMoves(fighterConfig) {
    const fallbackAttack = fighterConfig.attack
      ? [
          {
            id: "attack",
            command: ["attack"],
            sprite: "attack",
            ...fighterConfig.attack,
          },
        ]
      : [];

    const moves = fighterConfig.moves || fallbackAttack;

    return moves
      .map((move, index) => ({
        id: move.id || `move_${index}`,
        name: move.name || move.id || `Move ${index + 1}`,
        command: move.command || ["attack"],
        inputWindowMs: move.inputWindowMs || 450,
        priority: move.priority || 0,
        sprite: move.sprite || "attack",
        damage: move.damage ?? fighterConfig.attack?.damage ?? 20,
        hitFrame: move.hitFrame ?? fighterConfig.attack?.hitFrame ?? 4,
        hitbox: MoveResolver.firstHitbox(move, fighterConfig),
        hitboxes: MoveResolver.normalizeHitboxes(move, fighterConfig),
      }))
      .sort((moveA, moveB) => {
        const priorityDiff = moveB.priority - moveA.priority;
        if (priorityDiff !== 0) return priorityDiff;
        return moveB.command.length - moveA.command.length;
      });
  }

  getMove(fighter, input) {
    const moves = this.movesByFighter.get(fighter.playerId) || [];

    for (const move of moves) {
      if (input.consumeSequence(fighter.playerId, move.command, move.inputWindowMs)) {
        return move;
      }
    }

    return null;
  }

  static normalizeHitboxes(move, fighterConfig) {
    if (Array.isArray(move.hitboxes)) return move.hitboxes;
    if (move.hitbox) return [move.hitbox];
    if (Array.isArray(fighterConfig.attack?.hitboxes)) {
      return fighterConfig.attack.hitboxes;
    }
    if (fighterConfig.attack?.hitbox) return [fighterConfig.attack.hitbox];
    return [];
  }

  static firstHitbox(move, fighterConfig) {
    return MoveResolver.normalizeHitboxes(move, fighterConfig)[0];
  }
}
