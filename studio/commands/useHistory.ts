"use client";

import { useCallback, useRef, useState } from "react";

type HistoryState<T> = { past: T[]; present: T; future: T[] };

export function useHistory<T>(initial: T, limit = 80) {
  const [history, setHistory] = useState<HistoryState<T>>({ past: [], present: initial, future: [] });
  const transactionStart = useRef<T | undefined>(undefined);

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
  const beginTransaction = useCallback(() => setHistory((current) => {
    transactionStart.current ??= current.present;
    return current;
  }), []);
  const updateTransaction = useCallback((update: T | ((current: T) => T)) => setHistory((current) => ({
    ...current,
    present: typeof update === "function" ? (update as (value: T) => T)(current.present) : update,
    future: [],
  })), []);
  const endTransaction = useCallback(() => setHistory((current) => {
    const start = transactionStart.current;
    transactionStart.current = undefined;
    if (!start || Object.is(start, current.present)) return current;
    return { past: [...current.past.slice(-(limit - 1)), start], present: current.present, future: [] };
  }), [limit]);
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
    beginTransaction,
    updateTransaction,
    endTransaction,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
