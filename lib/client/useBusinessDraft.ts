"use client";

import React from "react";
import { useAppData } from "@/lib/client/useAppData";

const PREFIX = "boc-business-draft";

function storageKey(locationId: string, name: string) {
  return `${PREFIX}:${locationId}:${name}`;
}

function cloneValue<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

function resolveInitial<T>(initial: T | (() => T)): T {
  return typeof initial === "function" ? (initial as () => T)() : cloneValue(initial);
}

export function readBusinessDraft<T>(locationId: string | undefined, name: string): T | null {
  if (!locationId || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(locationId, name));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeBusinessDraft(locationId: string | undefined, name: string, value: unknown) {
  if (!locationId || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(locationId, name), JSON.stringify(value));
  } catch {
    // Ignore quota / private-mode failures; the live form still works.
  }
}

export function clearBusinessDraft(locationId: string | undefined, name: string) {
  if (!locationId || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(locationId, name));
  } catch {
    // Ignore storage failures.
  }
}

export function updateDraftField<T, K extends keyof T>(
  setDraft: React.Dispatch<React.SetStateAction<T>>,
  key: K,
): React.Dispatch<React.SetStateAction<T[K]>> {
  return (action) => {
    setDraft((current) => ({
      ...current,
      [key]:
        typeof action === "function"
          ? (action as (previous: T[K]) => T[K])(current[key])
          : action,
    }));
  };
}

/**
 * Session draft for create/edit forms, scoped per business.
 * clearDraft() wipes storage + in-memory state and skips the unmount re-save
 * that previously restored the form after a successful submit.
 */
export function useBusinessDraft<T>(
  name: string,
  initial: T | (() => T),
  options?: { enabled?: boolean },
) {
  const { currentLocation } = useAppData();
  const locationIdRef = React.useRef(currentLocation?.id);
  if (!locationIdRef.current && currentLocation?.id) {
    locationIdRef.current = currentLocation.id;
  }
  const enabled = options?.enabled !== false;
  const enabledRef = React.useRef(enabled);
  enabledRef.current = enabled;

  const initialFactoryRef = React.useRef(initial);
  initialFactoryRef.current = initial;

  const makeEmpty = React.useCallback(() => resolveInitial(initialFactoryRef.current), []);

  const [state, setState] = React.useState<T>(() => makeEmpty());
  const [ready, setReady] = React.useState(!enabled);
  const readyRef = React.useRef(ready);
  readyRef.current = ready;
  const stateRef = React.useRef(state);
  stateRef.current = state;
  /** When true, unmount must not write the old form back into sessionStorage. */
  const skipUnmountPersistRef = React.useRef(false);

  const persist = React.useCallback((value: T) => {
    if (!enabledRef.current) return;
    writeBusinessDraft(locationIdRef.current, name, value);
  }, [name]);

  const setDraft = React.useCallback((action: React.SetStateAction<T>) => {
    setState((previous) => {
      const next = typeof action === "function" ? (action as (value: T) => T)(previous) : action;
      stateRef.current = next;
      if (readyRef.current) persist(next);
      return next;
    });
  }, [persist]);

  React.useEffect(() => {
    if (!enabled) {
      setReady(true);
      readyRef.current = true;
      return;
    }
    const saved = readBusinessDraft<T>(locationIdRef.current, name);
    if (saved !== null) {
      stateRef.current = saved;
      setState(saved);
      persist(saved);
    }
    setReady(true);
    readyRef.current = true;
  }, [enabled, name, persist]);

  React.useEffect(() => {
    return () => {
      if (skipUnmountPersistRef.current) return;
      persist(stateRef.current);
    };
  }, [persist]);

  const clearDraft = React.useCallback(() => {
    skipUnmountPersistRef.current = true;
    clearBusinessDraft(locationIdRef.current, name);
    const empty = makeEmpty();
    stateRef.current = empty;
    setState(empty);
  }, [makeEmpty, name]);

  return {
    draft: state,
    setDraft,
    clearDraft,
    draftReady: ready,
    locationId: locationIdRef.current,
  };
}
