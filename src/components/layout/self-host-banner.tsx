"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export function SelfHostBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <>
      <style jsx>{`
        @keyframes rotateY {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        .spinning-heart {
          display: inline-block;
          animation: rotateY 2s linear infinite;
        }
      `}</style>
      <div
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-zinc-900/95 px-4 py-3 text-white backdrop-blur-sm border-b border-zinc-700/50 transition-transform duration-500 ease-out ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex flex-col items-center gap-0.5 text-center text-sm">
          <span className="flex items-center gap-3 font-medium">
            <span className="spinning-heart text-2xl">💖</span>
            Available for self-hosting.
            <span className="spinning-heart text-2xl">💖</span>
          </span>
          <a
            href="https://github.com/TilakMaddy/battle-chain-gui"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white/80 transition-colors"
          >
            github.com/TilakMaddy/battle-chain-gui
          </a>
        </div>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => setDismissed(true), 500);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-zinc-700 p-1.5 hover:bg-zinc-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
