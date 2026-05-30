class CollisionSystem {
  static rectanglesOverlap(rectangleA, rectangleB) {
    return (
      rectangleA.position.x + rectangleA.width > rectangleB.position.x &&
      rectangleA.position.x < rectangleB.position.x + rectangleB.width &&
      rectangleA.position.y + rectangleA.height > rectangleB.position.y &&
      rectangleA.position.y < rectangleB.position.y + rectangleB.height
    );
  }

  static attackOverlapsDefender(attacker, defender) {
    const hitboxes = attacker.getHitBoxes();
    const hurtboxes = defender.getHurtBoxes();

    return hitboxes.some((hitbox) =>
      hurtboxes.some((hurtbox) =>
        CollisionSystem.rectanglesOverlap(hitbox, hurtbox),
      ),
    );
  }

  static fightersOverlap(fighterA, fighterB) {
    return CollisionSystem.rectanglesOverlap(
      fighterA.getCollisionBox(),
      fighterB.getCollisionBox(),
    );
  }

  static resolveBodyCollision(fighterA, fighterB) {
    if (!CollisionSystem.fightersOverlap(fighterA, fighterB)) return;

    const boxA = fighterA.getCollisionBox();
    const boxB = fighterB.getCollisionBox();
    const centerA = boxA.position.x + boxA.width / 2;
    const centerB = boxB.position.x + boxB.width / 2;
    const overlapFromLeft = boxA.position.x + boxA.width - boxB.position.x;
    const overlapFromRight = boxB.position.x + boxB.width - boxA.position.x;
    const overlap = Math.min(overlapFromLeft, overlapFromRight);
    const direction = centerA <= centerB ? -1 : 1;
    const fighterAMovable = fighterA.canControl();
    const fighterBMovable = fighterB.canControl();

    if (fighterAMovable && fighterBMovable) {
      fighterA.position.x += direction * (overlap / 2);
      fighterB.position.x -= direction * (overlap / 2);
    } else if (fighterAMovable) {
      fighterA.position.x += direction * overlap;
    } else if (fighterBMovable) {
      fighterB.position.x -= direction * overlap;
    }

    fighterA.clampToStage();
    fighterB.clampToStage();
  }
}
