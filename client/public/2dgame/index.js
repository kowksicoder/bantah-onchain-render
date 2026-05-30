window.addEventListener("DOMContentLoaded", async () => {
  const assetVersion = "engine-20260529-20";
  const params = new URLSearchParams(window.location.search);
  const isArenaEmbed = params.get("battle-section") === "1";
  const root = document.querySelector(".bantah-fighting-game") || document;

  const engine = new GameEngine({
    canvas: root.querySelector("canvas"),
    timerElement: root.querySelector(".timer"),
    dialogElement: root.querySelector(".dialog"),
    rootElement: root,
    stagePath: `data/stages/hills.json?v=${assetVersion}`,
    fighterPaths: [
      `data/fighters/player1.json?v=${assetVersion}`,
      `data/fighters/player2.json?v=${assetVersion}`,
    ],
    autonomous: isArenaEmbed,
    assetBasePath: "/2dgame/",
  });
  window.gameEngine = engine;
  window.addEventListener("message", (event) => {
    const payload = event.data;
    if (!payload || payload.type !== "bantahbro:arena-state") return;
    engine.applyArenaPayload(payload);
  });

  try {
    await engine.start();
    if (isArenaEmbed && window.parent) {
      window.parent.postMessage({ type: "bantahbro:arena-ready" }, "*");
    }
  } catch (error) {
    console.error(error);
    const dialog = root.querySelector(".dialog");
    dialog.style.display = "flex";
    dialog.innerHTML = "Engine failed to load";
  }
});
