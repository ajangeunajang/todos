"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 220;
const PAD = 16;

interface Props {
  text: string;
  // Center of the grape being edited, in viewport pixels.
  x: number;
  y: number;
  vw: number;
  onSubmit: (first: string, second: string) => void;
  onCancel: () => void;
}

/** Long-press editor for a todo: edit its text and, optionally, split off a second todo. */
export default function SplitEditor({ text, x, y, vw, onSubmit, onCancel }: Props) {
  const [first, setFirst] = useState(text);
  const [second, setSecond] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);

  useEffect(() => secondRef.current?.focus(), []);

  const submit = () => {
    const a = first.trim();
    if (!a) return;
    onSubmit(a, second.trim());
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const inputClass =
    "w-full bg-transparent text-ink placeholder-ink/40 py-1 text-xs sm:text-sm outline-none border-b border-ink";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      // Tapping anywhere outside the box cancels.
      onBlur={(e) => {
        if (!formRef.current?.contains(e.relatedTarget as Node | null)) onCancel();
      }}
      className="absolute z-30 flex flex-col gap-2 border border-ink bg-[#ededed] p-3 text-ink"
      style={{
        width: WIDTH,
        left: Math.min(Math.max(x - WIDTH / 2, PAD), vw - WIDTH - PAD),
        top: y - 48,
        animation: "peekIn 0.2s ease-out",
      }}
    >
      <input value={first} onChange={(e) => setFirst(e.target.value)} onKeyDown={onKeyDown} className={inputClass} />
      <input
        ref={secondRef}
        value={second}
        onChange={(e) => setSecond(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="second task..."
        className={inputClass}
      />
      <p className="flex justify-between text-[10px] sm:text-xs opacity-50">
        <span>{second.trim() ? "enter to split" : "enter to rename"}</span>
        <span>esc</span>
      </p>
    </form>
  );
}
