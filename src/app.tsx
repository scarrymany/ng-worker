import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutGrid, ArrowLeftRight, Archive, Heart, PackagePlus, Settings as Cog, Plus, ArrowLeft, Minus, Square, X, Wallet, TrendingUp,
} from 'lucide-react';
import { buildCatalog, SECTIONS, type Entry } from './lib/catalog';
import { computeLedger, type Ledger } from './lib/ledger';
import { isTauri, useStore, type Deal, type DealType } from './lib/store';
import { CountUp, Toasts } from './components/ui';
import { DealModal } from './components/DealModal';
import { CustomModal } from './components/CustomModal';
import { Overview } from './pages/Overview';
import { Deals } from './pages/Deals';
import { Stock } from './pages/Stock';
import { CatalogPage } from './pages/Catalog';
import { ItemPage } from './pages/ItemPage';
import { SettingsPage } from './pages/Settings';

export type Route =
  | { name: 'overview' }
  | { name: 'deals' }
  | { name: 'stock' }
  | { name: 'favs' }
  | { name: 'custom' }
  | { name: 'settings' }
  | { name: 'section'; key: string }
  | { name: 'item'; id: string };

export interface DealPreset { entry?: Entry; type?: DealType; deal?: Deal; price?: number; qty?: number }
export interface CustomPreset { section?: string; edit?: string }

interface Ctx {
  route: Route;
  go: (r: Route) => void;
  back: () => void;
  canBack: boolean;
  catalog: Entry[];
  byId: Map<string, Entry>;
  ledger: Ledger;
  openDeal: (p?: DealPreset) => void;
  openCustom: (p?: CustomPreset) => void;
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

const routeKey = (r: Route) => r.name + ('key' in r ? ':' + r.key : '') + ('id' in r ? ':' + r.id : '');

export function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'overview' }]);
  const route = stack[stack.length - 1];
  const deals = useStore((s) => s.deals);
  const custom = useStore((s) => s.custom);
  const renames = useStore((s) => s.renames);
  const discovered = useStore((s) => s.discovered);
  const catalog = useMemo(() => buildCatalog(custom, renames, discovered), [custom, renames, discovered]);
  const byId = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);
  const ledger = useMemo(() => computeLedger(deals), [deals]);
  const [deal, setDeal] = useState<{ open: boolean; preset?: DealPreset }>({ open: false });
  const [cust, setCust] = useState<{ open: boolean; preset?: CustomPreset }>({ open: false });

  const go = useCallback((r: Route) => {
    setStack((s) => {
      const top = s[s.length - 1];
      if (routeKey(top) === routeKey(r)) return s;
      // Sidebar destinations reset history; item pages stack on top.
      return r.name === 'item' ? [...s.slice(-20), r] : [r];
    });
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const openDeal = useCallback((p?: DealPreset) => setDeal({ open: true, preset: p }), []);
  const openCustom = useCallback((p?: CustomPreset) => setCust({ open: true, preset: p }), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input,textarea');
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyN') { e.preventDefault(); openDeal(); }
      if (e.key === 'Backspace' && !typing && !deal.open && !cust.open) back();
      if (e.altKey && e.key === 'ArrowLeft') back();
    };
    const m = (e: MouseEvent) => e.button === 3 && back();
    window.addEventListener('keydown', h);
    window.addEventListener('mouseup', m);
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('mouseup', m); };
  }, [openDeal, back, deal.open, cust.open]);

  const ctx: Ctx = { route, go, back, canBack: stack.length > 1, catalog, byId, ledger, openDeal, openCustom };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <Sidebar />
        <main className="main">
          <motion.div
            key={routeKey(route)}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Page route={route} />
          </motion.div>
        </main>
      </div>
      <DealModal open={deal.open} preset={deal.preset} onClose={() => setDeal((d) => ({ ...d, open: false }))} />
      <CustomModal open={cust.open} preset={cust.preset} onClose={() => setCust((d) => ({ ...d, open: false }))} />
      <Toasts />
    </AppCtx.Provider>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'overview': return <Overview />;
    case 'deals': return <Deals />;
    case 'stock': return <Stock />;
    case 'favs': return <CatalogPage mode="favs" />;
    case 'custom': return <CatalogPage mode="custom" />;
    case 'section': return <CatalogPage mode="section" sectionKey={route.key} />;
    case 'item': return <ItemPage id={route.id} />;
    case 'settings': return <SettingsPage />;
  }
}

// ---------- sidebar ----------
function NavItem({ icon: Icon, label, count, active, onClick }: { icon: typeof LayoutGrid; label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button className={'nav-item' + (active ? ' active' : '')} onClick={onClick}>
      {active && <motion.i layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      <Icon />
      <span>{label}</span>
      {count !== undefined && count > 0 && <em>{count}</em>}
    </button>
  );
}

function Sidebar() {
  const { route, go, catalog, ledger } = useApp();
  const deals = useStore((s) => s.deals.length);
  const favs = useStore((s) => s.favs.length);
  const custom = useStore((s) => s.custom.length);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of catalog) m[e.section] = (m[e.section] || 0) + 1;
    return m;
  }, [catalog]);
  const stockCount = [...ledger.items.values()].filter((s) => s.held > 0).length;
  const isSec = (k: string) => route.name === 'section' && route.key === k;
  return (
    <aside className="side">
      <div className="brand" data-tauri-drag-region>
        <span className="brand-mark">NW</span>
        <div className="brand-text"><b>NG Worker</b><span>облік угод · UA</span></div>
      </div>
      <div className="side-group">Облік</div>
      <NavItem icon={LayoutGrid} label="Огляд" active={route.name === 'overview'} onClick={() => go({ name: 'overview' })} />
      <NavItem icon={ArrowLeftRight} label="Угоди" count={deals} active={route.name === 'deals'} onClick={() => go({ name: 'deals' })} />
      <NavItem icon={Archive} label="Склад" count={stockCount} active={route.name === 'stock'} onClick={() => go({ name: 'stock' })} />
      <div className="side-group">Каталог</div>
      {SECTIONS.map((s) => (
        <NavItem key={s.key} icon={s.icon} label={s.title} count={counts[s.key]} active={isSec(s.key)} onClick={() => go({ name: 'section', key: s.key })} />
      ))}
      <div className="side-group">Моє</div>
      <NavItem icon={Heart} label="Обране" count={favs} active={route.name === 'favs'} onClick={() => go({ name: 'favs' })} />
      <NavItem icon={PackagePlus} label="Свої предмети" count={custom} active={route.name === 'custom'} onClick={() => go({ name: 'custom' })} />
      <NavItem icon={Cog} label="Налаштування" active={route.name === 'settings'} onClick={() => go({ name: 'settings' })} />
    </aside>
  );
}

// ---------- top bar (also the window drag area) ----------
async function win(action: 'min' | 'max' | 'close') {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const w = getCurrentWindow();
  if (action === 'min') w.minimize();
  else if (action === 'max') w.toggleMaximize();
  else w.close();
}

export function Top({ title, sub, children, back }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; back?: boolean }) {
  const { ledger, openDeal, back: goBack, canBack, go } = useApp();
  const nick = useStore((s) => s.settings.nick);
  const t = ledger.totals;
  return (
    <header className="top" data-tauri-drag-region>
      {back && canBack && (
        <button className="top-back" onClick={goBack} title="Назад"><ArrowLeft size={18} /></button>
      )}
      <div className="top-title" data-tauri-drag-region>
        <h1 data-tauri-drag-region>{title}</h1>
        {sub && <small data-tauri-drag-region>{sub}</small>}
      </div>
      {children && <span className="top-sep" />}
      {children}
      <div className="top-spacer" data-tauri-drag-region />
      <div className="wallet" title="Чистий прибуток / оборот продажів" data-tauri-drag-region>
        <b className={t.realized < 0 ? 'neg' : ''}><TrendingUp /><CountUp value={t.realized} /></b>
        <span><Wallet /><CountUp value={t.revenue} /></span>
      </div>
      <button className="btn btn-outline" onClick={() => openDeal()}><Plus /> Додати угоду</button>
      <button className="round" onClick={() => go({ name: 'settings' })} title="Налаштування">{(nick || 'NG').slice(0, 2).toUpperCase()}</button>
      {isTauri && (
        <div className="winctl">
          <button onClick={() => win('min')} title="Згорнути"><Minus /></button>
          <button onClick={() => win('max')} title="Розгорнути"><Square style={{ width: 12, height: 12 }} /></button>
          <button className="close" onClick={() => win('close')} title="Закрити"><X /></button>
        </div>
      )}
    </header>
  );
}
