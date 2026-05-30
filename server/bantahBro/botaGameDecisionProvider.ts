import type {
  BotaAgentIntent,
  BotaArenaBattleState,
  BotaArenaFighter,
} from "@shared/botaArena";

export type BotaAgentDecisionProvider = {
  id: "mock-game" | "game-sdk";
  decide(input: {
    state: BotaArenaBattleState;
    actor: BotaArenaFighter;
    opponent: BotaArenaFighter;
  }): Promise<BotaAgentIntent>;
};

function healthRatio(fighter: BotaArenaFighter) {
  return fighter.maxHealth > 0 ? fighter.health / fighter.maxHealth : 0;
}

function hasCooldown(fighter: BotaArenaFighter, keyPrefix: string) {
  return Object.entries(fighter.cooldowns || {}).some(
    ([key, rounds]) => key.startsWith(keyPrefix) && rounds > 0,
  );
}

export class MockGameDecisionProvider implements BotaAgentDecisionProvider {
  id = "mock-game" as const;

  async decide(input: {
    state: BotaArenaBattleState;
    actor: BotaArenaFighter;
    opponent: BotaArenaFighter;
  }): Promise<BotaAgentIntent> {
    const { actor, opponent } = input;
    const actorHealth = healthRatio(actor);
    const opponentHealth = healthRatio(opponent);
    const behind = actorHealth + actor.energy / 220 < opponentHealth + opponent.energy / 220;
    const canSpecial = actor.energy >= 36 && !hasCooldown(actor, "special:");
    const canCounter = actor.energy >= 18 && !hasCooldown(actor, "counter");

    if (actorHealth < 0.3 && canCounter) {
      return {
        agentId: actor.id,
        source: "mock-game",
        action: "counter",
        skill: "Reversal Guard",
        target: "enemy",
        confidence: 0.68,
        rationale: "Low health fighter chooses a safer counter line.",
      };
    }

    if ((behind || opponentHealth < 0.45) && canSpecial) {
      return {
        agentId: actor.id,
        source: "mock-game",
        action: "special",
        skill: `${actor.archetype.replace(/_/g, " ")} Burst`,
        target: "enemy",
        confidence: 0.78,
        rationale: "Momentum window is strong enough to spend energy.",
      };
    }

    if (actor.energy < 18) {
      return {
        agentId: actor.id,
        source: "mock-game",
        action: "focus",
        skill: "Recharge Read",
        target: "self",
        confidence: 0.62,
        rationale: "Energy is low; recover before the next exchange.",
      };
    }

    if (actorHealth < 0.42 && opponent.energy > actor.energy) {
      return {
        agentId: actor.id,
        source: "mock-game",
        action: "defend",
        skill: "Pressure Shield",
        target: "self",
        confidence: 0.64,
        rationale: "Opponent has resource advantage, so reduce incoming damage.",
      };
    }

    return {
      agentId: actor.id,
      source: "mock-game",
      action: "attack",
      skill: "Signal Strike",
      target: "enemy",
      confidence: 0.58 + Math.min(0.28, actor.confidence / 260),
      rationale: "Default pressure action based on current battle state.",
    };
  }
}

export function getBotaDecisionProvider(): BotaAgentDecisionProvider {
  return new MockGameDecisionProvider();
}
