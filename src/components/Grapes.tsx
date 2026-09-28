"use client";

import { useState, useEffect, useRef } from "react";
import type { Grape } from "@/app/page";

export const HEADER_H = 200;
const PAD = 16;

// Deeper purple as grapes grow. Level 1 is a single completed task.
const LEVEL_COLORS = ["#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#7e22ce", "#6b21a8", "#581c87", "#3b0764"];

export function levelColor(level: number) {
  return LEVEL_COLORS[Math.min(level - 1, LEVEL_COLORS.length - 1)];
}

export function grapeSize(level: number, vw: number, vh: number) {
  const base = vw < 480 ? 84 : vw < 768 ? 96 : 112;
  const max = Math.min(vw - PAD * 2, vh - HEADER_H - PAD) * 0.8;
  return Math.min(base * Math.pow(1.3, level - 1), max);
}

// Grapes store their center as a fraction of the viewport; clamp so they stay on screen.
function center(g: Grape, size: number, vw: number, vh: number) {
  const r = size / 2;
  return {
    x: Math.min(Math.max(g.x * vw, PAD + r), vw - PAD - r),
    y: Math.min(Math.max(g.y * vh, HEADER_H + r), vh - PAD - r),
  };
}

interface Props {
  grapes: Grape[];
  onComplete: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMerge: (dragId: string, targetId: string) => void;
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

export default function Grapes({ grapes, onComplete, onMove, onMerge }: Props) {
  const [view, setView] = useState({ vw: 0, vh: 0 });
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const magnetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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
    e.currentTarget.setPointerCapture(e.pointerId);
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
        const label = g.tasks.length > 1 ? String(g.tasks.length) : g.tasks[0];

        return (
          <div
            key={g.id}
            className="absolute"
            style={{
              left: c.x - size / 2,
              top: c.y - size / 2,
              width: size,
              height: size,
              zIndex: isDragging ? 15 : g.done ? 2 : 1,
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
              className="w-full h-full"
              style={{ transition: "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
            >
              <button
                onPointerDown={(e) => handlePointerDown(e, g)}
                onPointerMove={(e) => handlePointerMove(e, g)}
                onPointerUp={(e) => handlePointerUp(e, g)}
                onPointerCancel={handlePointerCancel}
                title={g.tasks.join("\n")}
                className={`w-full h-full rounded-full flex items-center justify-center text-center p-3 select-none transition-colors ${
                  g.done ? "cursor-grab active:cursor-grabbing" : "bg-zinc-100 hover:bg-zinc-200"
                }`}
                style={{
                  touchAction: "none",
                  backgroundColor: g.done ? levelColor(g.level) : undefined,
                  transform: isTarget ? "scale(1.12)" : isDragging ? "scale(1.05)" : "scale(1)",
                  transition: "transform 0.2s ease, background-color 0.3s ease",
                  animation: "grapeIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <span
                  className={`leading-snug pointer-events-none ${g.done ? "text-white" : "text-zinc-900"} ${
                    g.tasks.length > 1 ? "text-sm sm:text-base" : "text-[10px] sm:text-xs"
                  }`}
                  style={{
                    wordBreak: "break-word",
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {label}
                </span>
              </button>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes grapeIn {
          from { transform: scale(0.4); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
