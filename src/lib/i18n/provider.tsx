import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { UI_MESSAGES } from "./catalog";
import { ENGLISH } from "./english";
import { isSupportedLanguage, RTL_LANGUAGES } from "./languages";
import { translateInterfaceBatch } from "./free-translate";

export const LANGUAGE_STORAGE_KEY = "insurtalent_language";
const CACHE_PREFIX = "insurtalent_translations_v1_";
const messages = new Set<string>(UI_MESSAGES);
const caches = new Map<string, Record<string, string>>([["en", { ...ENGLISH }]]);
const listeners = new Set<() => void>();
const queues = new Map<string, Set<string>>();
const failed = new Set<string>();
let selected = "es";
let version = 0;
let running = false;
let scheduled: ReturnType<typeof setTimeout> | undefined;
let abort: AbortController | undefined;

function notify() {
  version++;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function snapshot() {
  return `${selected}:${version}`;
}
function serverSnapshot() {
  return "es:0";
}

function loadCache(code: string) {
  if (typeof window === "undefined") return;
  const cached = caches.get(code) ?? {};
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_PREFIX + code) ?? "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, translation] of Object.entries(value)) {
        if (messages.has(key) && typeof translation === "string" && translation.length <= 6000)
          cached[key] = translation;
      }
    }
  } catch {
    /* Storage may be blocked; keep the in-memory cache. */
  }
  caches.set(code, cached);
}

export function selectLanguage(code: string) {
  if (!isSupportedLanguage(code)) return;
  abort?.abort();
  if (scheduled) clearTimeout(scheduled);
  scheduled = undefined;
  queues.clear();
  loadCache(code);
  selected = code;
  failed.delete(code);
  if (code !== "es") {
    const statusMessages = ["Cambiar idioma", "Preparando traducción…"];
    queues.set(code, new Set(statusMessages.filter((source) => !caches.get(code)?.[source])));
  }
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* Optional persistence. */
  }
  notify();
}

function translate(source: string, language: string) {
  if (language === "es" || !messages.has(source)) return source;
  const cached = caches.get(language)?.[source];
  if (cached) return cached;
  if (typeof window !== "undefined" && !failed.has(language)) {
    const queue = queues.get(language) ?? new Set<string>();
    queue.add(source);
    queues.set(language, queue);
    if (!scheduled && !running)
      scheduled = setTimeout(() => {
        scheduled = undefined;
        void flush();
      }, 100);
  }
  return source;
}

async function flush() {
  if (running || selected === "es" || failed.has(selected)) return;
  const language = selected;
  const queue = queues.get(language);
  if (!queue?.size) return;
  running = true;
  const controller = new AbortController();
  abort = controller;
  notify();
  try {
    while (queue.size && selected === language && !controller.signal.aborted) {
      const batch: string[] = [];
      let size = 0;
      for (const source of queue) {
        if (batch.length && (batch.length >= 12 || size + source.length > 1500)) break;
        batch.push(source);
        size += source.length;
      }
      const timeout = setTimeout(() => controller.abort(), 15000);
      let results: string[];
      try {
        results = await translateInterfaceBatch(batch, language, controller.signal);
      } finally {
        clearTimeout(timeout);
      }
      if (selected !== language) break;
      const cache = caches.get(language) ?? {};
      batch.forEach((source, index) => {
        cache[source] = results[index];
        queue.delete(source);
      });
      caches.set(language, cache);
      try {
        localStorage.setItem(CACHE_PREFIX + language, JSON.stringify(cache));
      } catch {
        /* No storage required. */
      }
      notify();
    }
  } catch {
    if (selected === language) {
      failed.add(language);
      queue.clear();
    }
  } finally {
    running = false;
    if (abort === controller) abort = undefined;
    notify();
    if (selected !== language && queues.get(selected)?.size) void flush();
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let saved = "es";
    try {
      saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "es";
    } catch {
      /* Spanish default. */
    }
    selectLanguage(isSupportedLanguage(saved) ? saved : "es");
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY)
        selectLanguage(isSupportedLanguage(event.newValue ?? "") ? event.newValue! : "es");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return children;
}

export function useLanguage() {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const language = state.split(":")[0];
  return useMemo(
    () => ({
      language,
      ready: state !== "es:0",
      direction: RTL_LANGUAGES.has(language) ? ("rtl" as const) : ("ltr" as const),
      tr: (source: string | null | undefined) => (source ? translate(source, language) : ""),
      setLanguage: selectLanguage,
      translating:
        language !== "es" && !failed.has(language) && (!!queues.get(language)?.size || running),
      unavailable: failed.has(language),
      formatDate: (value: string | Date) => {
        try {
          return new Date(value).toLocaleDateString(language === "es" ? "es-MX" : language);
        } catch {
          return new Date(value).toLocaleDateString("es-MX");
        }
      },
    }),
    [state, language],
  );
}
