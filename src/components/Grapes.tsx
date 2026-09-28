"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { Grape, ScorePop } from "@/app/page";

export const HEADER_H = 200;
const PAD = 16;
// Room under the lowest grape for its count label.
const LABEL_H = 24;
const PEEK_MS = 3000;
const PEEK_MAX = 8;

// Shine Muscat green (#c0ed00) for every completed grape; size alone shows the level.
// Grapes use mix-blend-mode: multiply over the #ededed background, so this is
// #c0ed00 divided by #ededed — it renders as exactly #c0ed00 on the page.
const GRAPE_COLOR = "#cfff00";

// Merged grapes (level 2+) render as a photo; its white backdrop vanishes under multiply.
const GRAPE_IMAGE = "/샤인머스켓.png";

// Stable per-grape tilt so the photos don't all face the same way.
function tilt(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(h) % 60) - 30;
}

export function grapeSize(level: number, vw: number, vh: number) {
  const base = vw < 480 ? 84 : vw < 768 ? 96 : 112;
  const max = Math.min(vw - PAD * 2, vh - HEADER_H - PAD) * 0.8;
  return Math.min(base * Math.pow(1.3, level - 1), max);
}

// Grapes store their center as a fraction of the viewport; clamp so they stay on screen.
function center(g: Pick<Grape, "x" | "y">, size: number, vw: number, vh: number) {
  const r = size / 2;
  return {
    x: Math.min(Math.max(g.x * vw, PAD + r), vw - PAD - r),
    y: Math.min(Math.max(g.y * vh, HEADER_H + r), vh - PAD - LABEL_H - r),
  };
}

interface Props {
  grapes: Grape[];
  onComplete: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMerge: (dragId: string, targetId: string) => void;
  pops: ScorePop[];
}

interface DragInfo {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  offX: number;
  offY: number;
  moved: boolean;
}

export default function Grapes({ grapes, onComplete, onMove, onMerge, pops }: Props) {
  const [view, setView] = useState({ vw: 0, vh: 0 });
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const magnetRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Merged grape whose finished todos are briefly shown under its count.
  const [peek, setPeek] = useState<string | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(peekTimer.current), []);

  const togglePeek = (id: string) => {
    clearTimeout(peekTimer.current);
    if (peek === id) {
      setPeek(null);
      return;
    }
    setPeek(id);
    peekTimer.current = setTimeout(() => setPeek(null), PEEK_MS);
  };

  useEffect(() => {
    const onResize = () => setView({ vw: window.innerWidth, vh: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { vw, vh } = view;

  // Gentle magnet pull toward the cursor, skipped while dragging.
  useEffect(() => {
    if (!vw) return;
    const handleMouseMove = (e: MouseEvent) => {
      grapes.forEach((g) => {
        const el = magnetRefs.current.get(g.id);
        if (!el) return;
        if (dragRef.current?.moved) {
          el.style.transform = "translate(0px, 0px)";
          return;
        }
        const size = grapeSize(g.level, vw, vh);
        const c = center(g, size, vw, vh);
        const dx = e.clientX - c.x;
        const dy = e.clientY - c.y;
        const dist = Math.hypot(dx, dy);
        const radius = size * 1.5;
        if (dist < radius) {
          const pull = Math.pow(1 - dist / radius, 2) * 0.35;
          el.style.transform = `translate(${dx * pull}px, ${dy * pull}px)`;
        } else {
          el.style.transform = "translate(0px, 0px)";
        }
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [grapes, vw, vh]);

  if (!vw) return null;

  const findTarget = (dragged: Grape, x: number, y: number) => {
    if (!dragged.done) return null;
    const dSize = grapeSize(dragged.level, vw, vh);
    let best: { id: string; dist: number } | null = null;
    for (const g of grapes) {
      if (g.id === dragged.id || !g.done || g.level !== dragged.level) continue;
      const size = grapeSize(g.level, vw, vh);
      const c = center(g, size, vw, vh);
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist < (size + dSize) / 2 * 0.75 && (!best || dist < best.dist)) best = { id: g.id, dist };
    }
    return best?.id ?? null;
  };

  const handlePointerDown = (e: React.PointerEvent, g: Grape) => {
    if (dragRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const c = center(g, grapeSize(g.level, vw, vh), vw, vh);
    dragRef.current = {
      id: g.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - c.x,
      offY: e.clientY - c.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent, g: Grape) => {
    const d = dragRef.current;
    if (!d || d.id !== g.id || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
    d.moved = true;
    const x = e.clientX - d.offX;
    const y = e.clientY - d.offY;
    setDrag({ id: g.id, x, y });
    setTarget(findTarget(g, x, y));
  };

  const handlePointerUp = (e: React.PointerEvent, g: Grape) => {
    const d = dragRef.current;
    if (!d || d.id !== g.id || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (!d.moved) {
      if (!g.done) onComplete(g.id);
      else if (g.level >= 2) togglePeek(g.id);
    } else {
      const x = e.clientX - d.offX;
      const y = e.clientY - d.offY;
      const t = findTarget(g, x, y);
      if (t) onMerge(g.id, t);
      else onMove(g.id, x / vw, y / vh);
    }
    setDrag(null);
    setTarget(null);
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    setDrag(null);
    setTarget(null);
  };

  return (
    <>
      {grapes.map((g) => {
        const size = grapeSize(g.level, vw, vh);
        const isDragging = drag?.id === g.id;
        const c = isDragging ? { x: drag.x, y: drag.y } : center(g, size, vw, vh);
        const isTarget = target === g.id;
        const isPhoto = g.done && g.level >= 2;
        const isPeeking = isPhoto && peek === g.id;
        // Flip the list above the grape when it would run off the bottom of the screen.
        const peekLines = Math.min(g.tasks.length, PEEK_MAX + 1);
        const peekAbove = c.y + size / 2 + LABEL_H + peekLines * 18 > vh - PAD;

        return (
          <div
            key={g.id}
            className="absolute"
            style={{
              left: c.x - size / 2,
              top: c.y - size / 2,
              width: size,
              height: size,
              zIndex: isDragging ? 15 : isPeeking ? 14 : g.done ? 2 : 1,
              mixBlendMode: "multiply",
              transition: isDragging
                ? "none"
                : "left 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          >
            <div
              ref={(el) => {
                if (el) magnetRefs.current.set(g.id, el);
                else magnetRefs.current.delete(g.id);
              }}
              className="relative w-full h-full"
              style={{ transition: "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
            >
              <button
                onPointerDown={(e) => handlePointerDown(e, g)}
                onPointerMove={(e) => handlePointerMove(e, g)}
                onPointerUp={(e) => handlePointerUp(e, g)}
                onPointerCancel={handlePointerCancel}
                title={g.tasks.join("\n")}
                className={`relative w-full h-full rounded-full flex items-center justify-center text-center p-3 select-none transition-colors ${
                  g.done ? "cursor-grab active:cursor-grabbing" : "bg-zinc-100 hover:bg-zinc-200"
                }`}
                style={{
                  touchAction: "none",
                  backgroundColor: g.done && !isPhoto ? GRAPE_COLOR : undefined,
                  transform: isTarget ? "scale(1.12)" : isDragging ? "scale(1.05)" : "scale(1)",
                  transition: "transform 0.2s ease, background-color 0.3s ease",
                  animation: "grapeIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                {isPhoto && (
                  <Image
                    src={GRAPE_IMAGE}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 60vw, 40vw"
                    draggable={false}
                    className="pointer-events-none object-contain scale-150"
                    style={{ rotate: `${tilt(g.id)}deg` }}
                  />
                )}
                {!isPhoto && (
                  <span
                    className={`relative leading-snug pointer-events-none text-[10px] sm:text-xs ${
                      g.done ? "text-lime-950" : "text-zinc-900"
                    }`}
                    style={{
                      wordBreak: "break-word",
                      display: "-webkit-box",
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {g.tasks[0]}
                  </span>
                )}
              </button>
              {/* Outside the button so the label can hang below the grape (captures clip button overflow). */}
              {isPhoto && (
                <div className="absolute left-1/2 top-full -translate-x-1/2 mt-1 flex flex-col items-center pointer-events-none">
                  {isPeeking && (
                    <ul
                      className={`leading-tight text-[10px] sm:text-xs text-zinc-900 whitespace-nowrap text-center ${
                        peekAbove ? "absolute bottom-full" : "order-last mt-1"
                      }`}
                      style={{ marginBottom: peekAbove ? size + 8 : undefined, animation: "peekIn 0.25s ease-out" }}
                    >
                      {g.tasks.slice(0, PEEK_MAX).map((t, i) => (
                        <li key={i}>
                          <span className="px-1 text-lime-950" style={{ backgroundColor: GRAPE_COLOR }}>
                            {t}
                          </span>
                        </li>
                      ))}
                      {g.tasks.length > PEEK_MAX && <li className="opacity-50">+{g.tasks.length - PEEK_MAX} more</li>}
                    </ul>
                  )}
                  <span
                    className="px-1 leading-snug text-xs sm:text-sm text-lime-950"
                    // Key-colour highlight behind the count (compensated for multiply, like the grapes).
                    style={{ backgroundColor: GRAPE_COLOR }}
                  >
                    {g.tasks.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {pops.map((p) => {
        const c = center(p, grapeSize(p.level, vw, vh), vw, vh);
        return (
          <span
            key={p.id}
            className="absolute z-20 text-xs sm:text-sm text-zinc-900 pointer-events-none"
            style={{
              left: c.x,
              top: c.y - grapeSize(p.level, vw, vh) / 2,
              animation: "scorePop 0.9s ease-out forwards",
            }}
          >
            +{p.value}
          </span>
        );
      })}
      <style>{`
        @keyframes peekIn {
          from { transform: translateY(-4px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes scorePop {
          from { transform: translate(-50%, 0); opacity: 1; }
          to { transform: translate(-50%, -32px); opacity: 0; }
        }
        @keyframes grapeIn {
          from { transform: scale(0.4); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
