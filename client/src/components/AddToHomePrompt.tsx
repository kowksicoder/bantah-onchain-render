"use client"

import React, { useEffect, useState } from "react";
import {
  AppWindow,
  Download,
  PlusSquare,
  Share2,
  Smartphone,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "a2hs_shown_v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua);
}

function isMobile() {
  if (typeof window === "undefined") return false;
  return /Mobi|Android/i.test(window.navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = Boolean((window.navigator as any).standalone);
  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || displayModeStandalone;
}

export default function AddToHomePrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const alreadyShown = localStorage.getItem(STORAGE_KEY);
      if (alreadyShown) return;
      if (!isMobile()) return;
      if (isStandalone()) return;

      if (isIos()) {
        setShowIosInstructions(true);
        setOpen(true);
        return;
      }

      let didCapturePrompt = false;
      const onBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
        e.preventDefault();
        didCapturePrompt = true;
        setDeferredPrompt(e);
        setOpen(true);
      };

      window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);

      const fallbackTimer = window.setTimeout(() => {
        if (!didCapturePrompt) {
          setOpen(true);
        }
      }, 2000);

      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
        window.clearTimeout(fallbackTimer);
      };
    } catch (err) {
      // ignore
    }
  }, []);

  const dismiss = (remember = true) => {
    setOpen(false);
    setShowIosInstructions(false);
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch (_) {
        // ignore
      }
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      dismiss(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      dismiss(true);
    } catch (err) {
      dismiss(true);
    }
  };

  const canAutoInstall = !showIosInstructions && Boolean(deferredPrompt);

  const steps = showIosInstructions
    ? [
        { icon: Share2, text: "Tap Share in Safari" },
        { icon: PlusSquare, text: "Choose Add to Home Screen" },
        { icon: AppWindow, text: "Tap Add to finish" },
      ]
    : canAutoInstall
      ? [
          { icon: Download, text: "Tap Install below" },
          { icon: AppWindow, text: "Confirm install prompt" },
          { icon: Smartphone, text: "Open Bantah from your home screen" },
        ]
      : [
          { icon: Download, text: "Open your browser menu" },
          { icon: PlusSquare, text: "Tap Install app or Add to Home Screen" },
          { icon: AppWindow, text: "Confirm to place Bantah on your home screen" },
        ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) dismiss();
        setOpen(v);
      }}
    >
      <DialogContent className="max-w-[92vw] sm:max-w-sm p-0 gap-0 overflow-hidden border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="border-b border-slate-800 bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-slate-950 px-4 py-4">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
            <Smartphone className="h-3.5 w-3.5" />
            Quick setup
          </div>
          <DialogTitle className="text-base font-semibold tracking-tight text-white">
            {showIosInstructions ? "Add Bantah to Home Screen" : "Install Bantah App"}
          </DialogTitle>
          <p className="mt-1 text-xs text-slate-300">
            {showIosInstructions
              ? "Use Safari steps below for faster access next time."
              : "Launch instantly from your home screen with a native app feel."}
          </p>
        </div>

        <div className="px-4 py-3">
          <div className="space-y-2.5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={`${step.text}-${index}`}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-cyan-300">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-xs text-slate-200">
                    <span className="mr-1 text-cyan-300">{index + 1}.</span>
                    {step.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-800 px-4 py-3">
          {canAutoInstall ? (
            <>
              <Button
                variant="ghost"
                className="h-9 flex-1 text-slate-300 hover:text-white"
                onClick={() => dismiss(true)}
              >
                Maybe later
              </Button>
              <Button className="h-9 flex-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400" onClick={handleInstallClick}>
                Install
              </Button>
            </>
          ) : (
            <Button className="h-9 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400" onClick={() => dismiss(true)}>
              Got it
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
