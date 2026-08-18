"use client";

import { useCallback, useState } from "react";

type HistoryState<T> = { past: T[]; present: T; future: T[] };

export function useHistory<T>(initial: T, limit = 80) {
  const [history, setHistory] = useState<HistoryState<T>>({ past: [], present: initial, future: [] });

  const commit = useCallback((update: T | ((current: T) => T)) => {
    setHistory((current) => {
      const next = typeof update === "function" ? (update as (value: T) => T)(current.present) : update;
      if (Object.is(next, current.present)) return current;
      return {
        past: [...current.past.slice(-(limit - 1)), current.present],
        present: next,
        future: [],
      };
    });
  }, [limit]);

  const reset = useCallback((next: T) => setHistory({ past: [], present: next, future: [] }), []);
  const undo = useCallback(() => setHistory((current) => {
    const previous = current.past.at(-1);
    if (!previous) return current;
    return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
  }), []);
  const redo = useCallback(() => setHistory((current) => {
    const next = current.future[0];
    if (!next) return current;
    return { past: [...current.past, current.present], present: next, future: current.future.slice(1) };
  }), []);

  return {
    state: history.present,
    commit,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
