import { useParams } from "wouter";
import BantahBro from "./BantahBro";

export default function BantahBroPolymarketBattle() {
  const { battleId = "" } = useParams<{ battleId: string }>();

  return (
    <BantahBro
      initialSection="prediction-battle"
      initialDashboardTab="signals"
      initialPredictionBattleId={battleId}
    />
  );
}
