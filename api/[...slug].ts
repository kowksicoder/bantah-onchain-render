import type { VercelRequest, VercelResponse } from '@vercel/node';

let appHandler: any = null;
let initPromise: Promise<any> | null = null;

type ServerlessAppModule = {
  initAppForServerless: () => Promise<any>;
};

async function loadServerlessAppModule(): Promise<ServerlessAppModule> {
  return import('../dist/index.js') as Promise<ServerlessAppModule>;
}

async function ensureApp() {
  if (!appHandler) {
    if (!initPromise) {
      initPromise = (async () => {
        console.log("[INIT] Initializing Express app...");
        try {
          const { initAppForServerless } = await loadServerlessAppModule();
          const app = await initAppForServerless();
          appHandler = app;
          console.log("[OK] Express app ready");
          return appHandler;
        } catch (err) {
          console.error("[ERROR] Failed to initialize Express app:", err);
          throw err;
        }
      })();
    }
    await initPromise;
  }
  return appHandler;
}

async function runExpressApp(app: any, req: VercelRequest, res: VercelResponse) {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = (error?: unknown) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve();
    };

    res.once("finish", () => done());
    res.once("close", () => done());

    try {
      app(req, res, (error: unknown) => done(error));
    } catch (error) {
      done(error);
    }
  });
}

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    console.log(`[REQ] ${req.method} ${req.url}`);
    const app = await ensureApp();
    await runExpressApp(app, req, res);
  } catch (err) {
    console.error("[ERROR] Handler error:", err);
    return res.status(500).json({ 
      error: "Internal Server Error",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
}
