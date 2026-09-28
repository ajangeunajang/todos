"use client";

import { useState, useEffect, useRef } from "react";
import Grapes, { HEADER_H, grapeSize } from "@/components/Grapes";

export interface Grape {
  id: string;
  level: number;
  done: boolean;
  tasks: string[];
  // Center position as a fraction of the viewport (0–1).
  x: number;
  y: number;
}

export interface ScorePop {
  id: string;
  value: number;
  level: number;
  x: number;
  y: number;
}

const STORAGE_KEY = "grapes";
const SCORE_KEY = "grapes-score";

const newId = () => Math.random().toString(36).slice(2, 10);

// A fresh board starts with one merged Shine Muscat (2) so the photo grape is visible right away.
const defaultGrapes = (): Grape[] => [
  { id: newId(), level: 2, done: true, tasks: ["open merge-todos", "well begun is half done"], x: 0.5, y: 0.6 },
];

// Points a grape holding n tasks (a power of two, n = 2^k) is worth once earned:
// n for completing its tasks plus n for each of the k merges that built it.
const grapeValue = (n: number) => n + Math.log2(n) * n;

// Best final board for n tasks is its binary decomposition, since only equal sizes merge.
function fullBoardValue(n: number) {
  let total = 0;
  for (let size = 1; size <= n; size *= 2) if (n & size) total += grapeValue(size);
  return total;
}

function spawnPosition(existing: Grape[]) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const size = grapeSize(1, vw, vh);
  const r = size / 2;
  const minX = 16 + r;
  const maxX = vw - 16 - r;
  const minY = HEADER_H + r;
  const maxY = vh - 16 - r;

  let pos = { x: 0, y: 0 };
  for (let attempt = 0; attempt < 300; attempt++) {
    pos = {
      x: Math.random() * (maxX - minX) + minX,
      y: Math.random() * (maxY - minY) + minY,
    };
    const clear = existing.every((g) => {
      const gr = grapeSize(g.level, vw, vh) / 2;
      return Math.hypot(g.x * vw - pos.x, g.y * vh - pos.y) > gr + r + 8;
    });
    if (clear) break;
  }
  return { x: pos.x / vw, y: pos.y / vh };
}

export default function Home() {
  const [grapes, setGrapes] = useState<Grape[]>([]);
  const [score, setScore] = useState(0);
  const [pops, setPops] = useState<ScorePop[]>([]);
  // A captured share image waiting for a second tap (see shareImage), keyed to the board it shows.
  const [readyShare, setReadyShare] = useState<{ file: File; key: string } | null>(null);
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Restore after mount so server and client render the same first frame.
      const parsed: Grape[] = saved ? JSON.parse(saved) : [];
      // An empty board (first visit, or one saved by an older version) gets the default grape.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrapes(parsed.length ? parsed : defaultGrapes());
      setScore(Number(localStorage.getItem(SCORE_KEY)) || 0);
    } catch {}
    setMounted(true);
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(grapes));
      localStorage.setItem(SCORE_KEY, String(score));
    } catch {}
  }, [grapes, score, mounted]);

  // Completing earns 1; a merge earns the number of tasks the new grape holds.
  const addScore = (value: number, level: number, x: number, y: number) => {
    const id = newId();
    setScore((s) => s + value);
    setPops((prev) => [...prev, { id, value, level, x, y }]);
    setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 900);
  };

  const addTodo = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setGrapes((prev) => [
      ...prev,
      { id: newId(), level: 1, done: false, tasks: [trimmed], ...spawnPosition(prev) },
    ]);
    setInput("");
  };

  const completeGrape = (id: string) => {
    const g = grapes.find((g) => g.id === id);
    if (!g || g.done) return;
    addScore(1, g.level, g.x, g.y);
    setGrapes((prev) => prev.map((g) => (g.id === id ? { ...g, done: true } : g)));
  };

  const moveGrape = (id: string, x: number, y: number) => {
    setGrapes((prev) => prev.map((g) => (g.id === id ? { ...g, x, y } : g)));
  };

  const mergeGrapes = (dragId: string, targetId: string) => {
    const a = grapes.find((g) => g.id === dragId);
    const b = grapes.find((g) => g.id === targetId);
    if (!a || !b || !a.done || !b.done || a.level !== b.level) return;
    addScore(a.tasks.length + b.tasks.length, b.level + 1, b.x, b.y);
    setGrapes((prev) => {
      const merged: Grape = {
        id: newId(),
        level: b.level + 1,
        done: true,
        tasks: [...b.tasks, ...a.tasks],
        x: b.x,
        y: b.y,
      };
      return [...prev.filter((g) => g.id !== dragId && g.id !== targetId), merged];
    });
  };

  const reset = () => {
    if ((grapes.length || score) && confirm("clear all grapes and score?")) {
      setGrapes(defaultGrapes());
      setScore(0);
    }
  };

  const activeCount = grapes.filter((g) => !g.done).length;
  // Max possible score: what's earned so far plus what finishing and fully merging the board would add.
  const taskCount = grapes.reduce((n, g) => n + g.tasks.length, 0);
  const boardValue = grapes.reduce((v, g) => v + (g.done ? grapeValue(g.tasks.length) : 0), 0);
  const maxScore = score + fullBoardValue(taskCount) - boardValue;
  const levels = grapes.filter((g) => g.done).map((g) => g.level);
  const canMerge = levels.some((l, i) => levels.indexOf(l) !== i);

  const shareText = `${score}/${maxScore}. i did it.`;
  const shareUrl = "https://merge-todos.vercel.app";
  const shareKey = `${score}:${grapes.map((g) => g.id).join(",")}`;
  // Android share targets (e.g. KakaoTalk) reject an image bundled with text, so Android
  // shares the image alone and gets the message on the clipboard instead.
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  const downloadImage = (file: File) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const shareImage = async (file: File) => {
    const data: ShareData = isAndroid
      ? { files: [file] }
      : { files: [file], title: "極大粒シャインマスカット샤인머스켓", text: shareText, url: shareUrl };
    if (!navigator.canShare?.(data)) {
      downloadImage(file);
      return;
    }
    try {
      await navigator.share(data);
      setReadyShare(null);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      // Chrome only allows share() shortly after a tap; capturing can outlast that window.
      // Keep the image so the next tap shares it immediately.
      if (name === "NotAllowedError") setReadyShare({ file, key: shareKey });
      else if (name === "AbortError") setReadyShare(null);
      else downloadImage(file);
    }
  };

  const handleShare = async () => {
    const main = mainRef.current;
    if (!main) return;
    if (isAndroid) navigator.clipboard?.writeText(`${shareText} ${shareUrl}`).catch(() => {});
    if (readyShare?.key === shareKey) {
      await shareImage(readyShare.file);
      return;
    }
    const { toCanvas } = await import("html-to-image");
    const ratio = 2;
    // html-to-image drops the grape photos in some browsers, so capture without them
    // and paint the already-loaded photos onto the canvas ourselves.
    const canvas = await toCanvas(main, {
      pixelRatio: ratio,
      filter: (node) => !(node instanceof HTMLImageElement),
    });
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const origin = main.getBoundingClientRect();
      ctx.globalCompositeOperation = "multiply";
      main.querySelectorAll("img").forEach((img) => {
        const box = img.parentElement?.getBoundingClientRect();
        if (!box || !img.complete) return;
        const { rotate, scale } = getComputedStyle(img);
        ctx.save();
        ctx.scale(ratio, ratio);
        ctx.translate(box.left - origin.left + box.width / 2, box.top - origin.top + box.height / 2);
        ctx.rotate((parseFloat(rotate) || 0) * (Math.PI / 180));
        const k = parseFloat(scale) || 1;
        ctx.scale(k, k);
        ctx.drawImage(img, -box.width / 2, -box.height / 2, box.width, box.height);
        ctx.restore();
      });
    }
    // JPEG rather than PNG: KakaoTalk on Android rejects shared PNGs as an unsupported format.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    await shareImage(new File([blob], "merge-todos.jpg", { type: "image/jpeg", lastModified: Date.now() }));
  };

  return (
    <main ref={mainRef} className="relative min-h-svh bg-[#ededed] overflow-hidden">
      <div className="relative z-10 p-4 sm:p-8 max-w-sm">
        <p className="text-xs sm:text-sm text-zinc-900 mb-1" suppressHydrationWarning>
          {new Date().toISOString().slice(0, 10)}{time ? ` ${time}` : ""}
        </p>
        <h1 className="text-xs sm:text-sm text-zinc-900 mb-4 sm:mb-6">today&apos;s todos</h1>

        <div className="flex gap-2 items-end">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addTodo()}
            placeholder="add a task..."
            className="flex-1 bg-transparent text-zinc-900 placeholder-zinc-900 py-1.5 sm:py-2 text-xs sm:text-sm outline-none border-b border-zinc-900 transition"
          />
          <button
            onClick={addTodo}
            disabled={!input.trim()}
            className="text-zinc-900 text-lg sm:text-xl leading-none disabled:opacity-30 pb-1.5 sm:pb-2 hover:opacity-60 active:scale-95 transition"
          >
            +
          </button>
        </div>

        {canMerge && (
          <p className="mt-3 sm:mt-4 text-xs text-zinc-900 opacity-50">drag a grape onto its twin.</p>
        )}
      </div>

      {(grapes.length > 0 || score > 0) && (
        <div className="absolute top-0 right-0 z-10 p-4 sm:p-8 text-right text-xs sm:text-sm text-zinc-900 space-y-1 whitespace-nowrap">
          <p>
            score <span className="bg-[#c0ed00] text-lime-950 px-1">{score}</span> ({activeCount} to go)
          </p>
          <p className="flex gap-3 justify-end">
            {score > 0 && (
              <button onClick={handleShare} className="border-b border-zinc-900 hover:opacity-50 transition">
                {readyShare?.key === shareKey ? "tap to share" : "share"}
              </button>
            )}
            <button onClick={reset} className="border-b border-zinc-900 hover:opacity-50 transition">
              reset
            </button>
          </p>
        </div>
      )}

      {mounted && (
        <Grapes grapes={grapes} onComplete={completeGrape} onMove={moveGrape} onMerge={mergeGrapes} pops={pops} />
      )}

      <footer className="absolute bottom-0 left-0 w-full p-4 sm:p-8 z-0 space-y-1 sm:space-y-1.5 pointer-events-none">
        <p className="text-xs sm:text-sm text-zinc-900">© 2026. merge-todos. All rights reserved.</p>
        <p className="text-xs sm:text-sm text-zinc-900">Inquiries <span style={{ fontFamily: "sans-serif" }}>☞</span> ajangeunajang@gmail.com</p>
        <p className="text-xs sm:text-sm text-zinc-900">
          Design and Developed by{" "}
          <a href="https://www.ajangeunajang.com/" target="_blank" rel="noopener" className="no-underline pointer-events-auto" style={{ borderBottom: "1px dotted currentColor", paddingBottom: "2px" }}>
            Euna Jang
          </a>
        </p>
      </footer>
    </main>
  );
}
