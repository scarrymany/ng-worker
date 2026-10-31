import { useSyncExternalStore } from 'react';
import { dayKey } from './format';

export type DealType = 'buy' | 'sell';
export interface Deal {
  id: string;
  type: DealType;
  itemId: string;
  name: string;
  qty: number;
  price: number; // per unit
  fee: number; // absolute $, already paid
  ts: number;
  note?: string;
  variant?: number;
}
export interface CustomItem {
  id: string; // "u:..."
  name: string;
  section: string;
  cat: string;
  img?: string; // data URL
  created: number;
}
export interface Settings {
  fee: number; // default market fee % for sells
  nick: string;
}
export interface State {
  version: 1;
  deals: Deal[];
  custom: CustomItem[];
  favs: string[];
  renames: Record<string, string>;
  discovered: string[];
  settings: Settings;
}

const empty = (): State => ({ version: 1, deals: [], custom: [], favs: [], renames: {}, discovered: [], settings: { fee: 0, nick: 'NG' } });

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const LS_KEY = 'ng-worker-data';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args);
}

let state: State = empty();
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function normalize(raw: unknown): State {
  const s = raw as Partial<State>;
  const base = empty();
  if (!s || typeof s !== 'object' || !Array.isArray(s.deals)) throw new Error('Невірний формат файлу');
  return {
    version: 1,
    deals: s.deals.filter((d) => d && d.id && d.itemId && (d.type === 'buy' || d.type === 'sell')),
    custom: Array.isArray(s.custom) ? s.custom : [],
    favs: Array.isArray(s.favs) ? s.favs : [],
    renames: s.renames && typeof s.renames === 'object' ? s.renames : {},
    discovered: Array.isArray(s.discovered) ? s.discovered : [],
    settings: { ...base.settings, ...(s.settings || {}) },
  };
}

export async function initStore() {
  try {
    const raw = isTauri ? await invoke<string>('load_data') : localStorage.getItem(LS_KEY) || '';
    if (raw) state = normalize(JSON.parse(raw));
  } catch (e) {
    console.error('load failed', e);
  }
  ready = true;
  emit();
}

let saveTimer: number | undefined;
function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    const json = JSON.stringify(state);
    try {
      if (isTauri) {
        await invoke('save_data', { json });
        await invoke('daily_backup', { day: dayKey(Date.now()), json });
      } else localStorage.setItem(LS_KEY, json);
    } catch (e) {
      console.error('save failed', e);
    }
  }, 250);
}

export function setState(fn: (s: State) => State) {
  state = fn(state);
  emit();
  persist();
}

export const getState = () => state;
export const isReady = () => ready;

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(state),
  );
}

// ---- actions ----
export const actions = {
  addDeal(d: Deal) {
    setState((s) => ({ ...s, deals: [...s.deals, d] }));
  },
  updateDeal(d: Deal) {
    setState((s) => ({ ...s, deals: s.deals.map((x) => (x.id === d.id ? d : x)) }));
  },
  removeDeal(id: string): Deal | undefined {
    const d = state.deals.find((x) => x.id === id);
    setState((s) => ({ ...s, deals: s.deals.filter((x) => x.id !== id) }));
    return d;
  },
  toggleFav(id: string) {
    setState((s) => ({ ...s, favs: s.favs.includes(id) ? s.favs.filter((f) => f !== id) : [...s.favs, id] }));
  },
  addCustom(c: CustomItem) {
    setState((s) => ({ ...s, custom: [...s.custom, c] }));
  },
  updateCustom(c: CustomItem) {
    setState((s) => ({ ...s, custom: s.custom.map((x) => (x.id === c.id ? c : x)) }));
  },
  removeCustom(id: string) {
    setState((s) => ({ ...s, custom: s.custom.filter((x) => x.id !== id), favs: s.favs.filter((f) => f !== id) }));
  },
  settings(p: Partial<Settings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...p } }));
  },
  rename(id: string, name: string) {
    setState((s) => {
      const renames = { ...s.renames };
      if (name.trim()) renames[id] = name.trim();
      else delete renames[id];
      return { ...s, renames, deals: s.deals.map((d) => (d.itemId === id && name.trim() ? { ...d, name: name.trim() } : d)) };
    });
  },
  addDiscovered(urls: string[]) {
    setState((s) => ({ ...s, discovered: [...new Set([...s.discovered, ...urls])] }));
  },
  replaceAll(next: State) {
    setState(() => next);
  },
};

// ---- backup files ----
export async function exportBackup(): Promise<string | null> {
  const json = JSON.stringify(state, null, 1);
  const name = `ng-worker-backup-${dayKey(Date.now())}.json`;
  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: name, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!path) return null;
    await invoke('write_file', { path, contents: json });
    return path;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name;
  a.click();
  return name;
}

export async function pickBackup(): Promise<State | null> {
  let text: string | null = null;
  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!path || Array.isArray(path)) return null;
    text = await invoke<string>('read_file', { path });
  } else {
    text = await new Promise<string | null>((res) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,application/json';
      inp.onchange = () => (inp.files?.[0] ? inp.files[0].text().then(res) : res(null));
      inp.click();
    });
  }
  if (!text) return null;
  return normalize(JSON.parse(text));
}

/** Reads cdn.ng-gta5.com image URLs from the NGLauncher cache on disk (read-only). */
export async function scanGameCache(): Promise<string[]> {
  if (!isTauri) throw new Error('Доступно лише в застосунку для Windows');
  return invoke<string[]>('scan_game_cache');
}

export async function dataLocation(): Promise<string> {
  return isTauri ? invoke<string>('data_location') : 'localStorage (браузер)';
}
