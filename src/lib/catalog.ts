import raw from '../data/catalog.json';
import type { CustomItem } from './store';
import {
  Car, Building2, Store, Package, Shirt, Handshake, Hash, Smartphone, Landmark, type LucideIcon,
} from 'lucide-react';

export type Kind = 'item' | 'vehicle' | 'clothes' | 'custom' | 'property';
export interface Entry {
  id: string;
  kind: Kind;
  name: string;
  section: string;
  cat: string; // filter value inside section
  img?: string | null;
  photo?: string;
  variants?: string[];
  real?: string;
  desc?: string;
  specs?: [string, string][];
  gender?: string;
  fallback?: string;
  guess?: boolean;
  pack?: string;
  order: number;
}

export interface Section {
  key: string;
  title: string;
  icon: LucideIcon;
  filterLabel: string;
  singular: string;
}

export const SECTIONS: Section[] = [
  { key: 'vehicles', title: 'Транспорт', icon: Car, filterLabel: 'Тип', singular: 'Транспорт' },
  { key: 'realty', title: 'Нерухомість', icon: Building2, filterLabel: 'Тип', singular: 'Нерухомість' },
  { key: 'business', title: 'Бізнес', icon: Store, filterLabel: 'Тип', singular: 'Бізнес' },
  { key: 'atm', title: 'Банкомати', icon: Landmark, filterLabel: 'Тип', singular: 'Банкомат' },
  { key: 'items', title: 'Предмети', icon: Package, filterLabel: 'Категорія', singular: 'Предмет' },
  { key: 'clothes', title: 'Одяг та аксесуари', icon: Shirt, filterLabel: 'Тип', singular: 'Одяг' },
  { key: 'services', title: 'Послуги та інше', icon: Handshake, filterLabel: 'Тип', singular: 'Послуга' },
  { key: 'plates', title: 'Номерні знаки', icon: Hash, filterLabel: 'Тип', singular: 'Номерний знак' },
  { key: 'sim', title: 'SIM-картки', icon: Smartphone, filterLabel: 'Тип', singular: 'SIM-картка' },
];
export const sectionByKey = (k: string) => SECTIONS.find((s) => s.key === k) || SECTIONS[4];

const FUEL: Record<string, string> = { premium: 'Преміум', plus: 'Плюс', regular: 'Звичайний', diesel: 'Дизель', electro: 'Електро', kerosene: 'Гас' };

type RawV = {
  id: string; name: string; img: string | null; type: string; real?: string; speed?: number; seats?: number;
  drive?: string; fuel?: string; tank?: number; desc?: string; photo?: string; cls?: string;
  fallback?: string; guess?: boolean; body?: string; make?: string;
};
type RawI = { id: string; name: string; cat: string; img: string | null; fallback?: string; guess?: boolean };
type RawC = { id: string; name: string; sub: string; gender: string; img: string; variants: string[]; pack?: string };
type RawP = { id: string; name: string; section: string; cat: string; photo: string };
const data = raw as unknown as { items: RawI[]; vehicles: RawV[]; clothes: RawC[]; properties?: RawP[] };

const base: Entry[] = [];
let order = 0;
for (const i of data.items) {
  base.push({ id: 'i:' + i.id, kind: 'item', name: i.name, section: 'items', cat: i.cat, img: i.img, fallback: i.fallback, guess: i.guess, order: order++ });
}
for (const v of data.vehicles) {
  const specs: [string, string][] = [];
  if (v.real) specs.push(['Прототип', v.real]);
  if (v.make) specs.push(['Марка (прототип)', v.make.charAt(0) + v.make.slice(1).toLowerCase()]);
  if (v.body) specs.push(['Кузов', v.body]);
  if (v.cls) specs.push(['Клас', v.cls]);
  if (v.speed) specs.push(['Макс. швидкість', `${v.speed} км/год`]);
  if (v.drive) specs.push(['Привід', v.drive]);
  if (v.fuel) specs.push(['Паливо', FUEL[v.fuel] || v.fuel]);
  if (v.tank) specs.push(['Бак', `${v.tank} л`]);
  if (v.seats) specs.push(['Місць', String(v.seats)]);
  base.push({
    id: 'v:' + v.id, kind: 'vehicle', name: v.name, section: 'vehicles', cat: v.type, img: v.img, photo: v.photo,
    fallback: v.fallback, guess: v.guess, real: v.real, desc: v.desc, specs, order: order++,
  });
}
for (const c of data.clothes) {
  base.push({
    id: 'c:' + c.id, kind: 'clothes', name: c.name, section: 'clothes', cat: c.sub, gender: c.gender, img: c.img,
    variants: c.variants, pack: c.pack, order: order++,
  });
}
for (const p of data.properties || []) {
  base.push({ id: 'p:' + p.id, kind: 'property', name: p.name, section: p.section, cat: p.cat, img: null, photo: p.photo, order: order++ });
}

export const ITEM_CATS = [...new Set(base.filter((e) => e.section === 'items').map((e) => e.cat))].sort((a, b) =>
  a === 'Різне' ? 1 : b === 'Різне' ? -1 : a.localeCompare(b, 'uk'),
);
const known = new Set(base.flatMap((e) => [e.img, ...(e.variants || [])]).filter(Boolean) as string[]);

/** Turns a cdn.ng-gta5.com URL found in the game cache into a catalog entry (only for keys we don't know yet). */
export function entryFromUrl(url: string): Entry | null {
  if (known.has(url)) return null;
  const m = url.match(/cdn\.ng-gta5\.com\/(items|vehicles|properties)\/([^/]+)(?:\/([^/.]+))?/);
  if (!m) return null;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]+/g, ' ');
  if (m[1] === 'items') {
    const key = m[2].replace(/\.\w+$/, '');
    if (base.some((e) => e.id === 'i:' + key)) return null;
    return { id: 'i:' + key, kind: 'item', name: cap(key), section: 'items', cat: 'Нові з гри', img: url, guess: true, order: 1e6 };
  }
  if (m[1] === 'vehicles') {
    const key = m[2];
    if (base.some((e) => e.id === 'v:' + key || e.img === url)) return null;
    return { id: 'v:' + key, kind: 'vehicle', name: cap(key), section: 'vehicles', cat: 'Авто', img: url, guess: true, order: 1e6 };
  }
  const n = (m[3] || '').replace(/\.\w+$/, '');
  const house = m[2] === 'house';
  const id = 'p:' + (house ? 'house_' : 'biz_') + n;
  if (base.some((e) => e.id === id)) return null;
  return { id, kind: 'property', name: `${house ? 'Будинок' : 'Бізнес'} #${n}`, section: house ? 'realty' : 'business', cat: house ? 'Будинки' : 'Бізнеси', img: null, photo: url, order: 1e6 };
}

export function buildCatalog(custom: CustomItem[], renames: Record<string, string> = {}, discovered: string[] = []): Entry[] {
  const extra = discovered.map(entryFromUrl).filter(Boolean) as Entry[];
  const all = [
    ...custom.map((c, k) => ({
      id: c.id, kind: 'custom' as const, name: c.name, section: c.section, cat: c.cat || 'Свої', img: c.img || null, order: -1000 + k,
    })),
    ...base,
    ...extra,
  ];
  if (!Object.keys(renames).length) return all;
  return all.map((e) => (renames[e.id] ? { ...e, name: renames[e.id], guess: false } : e));
}

export const thumbOf = (e: Entry) => e.img || e.photo || null;
export const heroOf = (e: Entry) => e.photo || e.img || null;
