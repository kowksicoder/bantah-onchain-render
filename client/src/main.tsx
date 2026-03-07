import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { pushNotificationService } from "./lib/pushNotifications";
import { sdk } from "@farcaster/miniapp-sdk";

// Initialize push notifications
pushNotificationService.initialize().catch(console.error);

// Inject Botpress webchat scripts when enabled via Vite env var
// Note: Botpress script loading is disabled to prevent conflicts with React initialization
const botpressEnabled = false; // (import.meta as any).env?.VITE_BOTPRESS_WIDGET !== 'false';
if (botpressEnabled) {
  const injectScript = document.createElement('script');
  injectScript.src = 'https://cdn.botpress.cloud/webchat/v3.5/inject.js';
  document.head.appendChild(injectScript);

  // Defer external script loading to after React has fully initialized
  setTimeout(() => {
    const remoteScript = document.createElement('script');
    remoteScript.src = 'https://files.bpcontent.cloud/2025/06/14/17/20250614171821-RZO5DCSV.js';
    remoteScript.defer = true;
    document.head.appendChild(remoteScript);
  }, 2000); // Wait 2 seconds to ensure React is fully initialized
}

createRoot(document.getElementById("root")!).render(<App />);

// Signal readiness when running inside Base/Farcaster mini app hosts.
const signalMiniAppReady = () => {
  let attempts = 0;
  const maxAttempts = 20;

  const attemptReady = async () => {
    attempts += 1;
    try {
      await sdk.actions.ready();
      return;
    } catch {
      // Ignore outside mini app environments.
    }

    if (attempts < maxAttempts) {
      setTimeout(attemptReady, 300);
    }
  };

  setTimeout(attemptReady, 0);
};

signalMiniAppReady();
