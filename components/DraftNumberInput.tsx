"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "onKeyDown"> & {
  value: number;
  onCommit: (value: number) => void;
  onInvalid?: () => void;
};

export function DraftNumberInput({ value, onCommit, onInvalid, min, max, ...props }: Props) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  function commit() {
    const parsed = Number(draft);
    const minimum = typeof min === "number" ? min : min === undefined ? undefined : Number(min);
    const maximum = typeof max === "number" ? max : max === undefined ? undefined : Number(max);
    const valid = draft.trim() !== "" && Number.isFinite(parsed) &&
      (minimum === undefined || parsed >= minimum) &&
      (maximum === undefined || parsed <= maximum);
    if (!valid) {
      setDraft(String(value));
      onInvalid?.();
      return;
    }
    onCommit(parsed);
  }

  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        commit();
        setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
    />
  );
}
