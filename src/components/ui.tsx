import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Heart, X, Check, AlertTriangle, type LucideIcon } from 'lucide-react';
import { actions, isTauri, useStore } from '../lib/store';
import type { Entry } from '../lib/catalog';
import { money } from '../lib/format';

const spring = { type: 'spring', stiffness: 520, damping: 40 } as const;

// ---------- quick-bar dropdown (as in the NG market header) ----------
export function Quick<T extends string>({
  icon: Icon, label, value, options, onChange,
}: {
  icon: LucideIcon; label: string; value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open]);
  const cur = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={'quick' + (open ? ' open' : '')} onClick={() => setOpen(!open)}>
        <Icon />
        <span className="q-label">{label}:</span> <b>{cur?.label ?? value}</b>
        <ChevronDown className="chev" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu"
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {options.map((o) => (
              <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.label}
                {o.value === value ? <Check size={14} /> : o.count !== undefined ? <em>{o.count}</em> : null}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- segmented control with sliding pill ----------
export function Seg<T extends string>({
  value, options, onChange, className = '',
}: { value: T; options: { value: T; label: ReactNode; count?: number; cls?: string }[]; onChange: (v: T) => void; className?: string }) {
  const id = useId();
  return (
    <div className={'seg ' + className}>
      {options.map((o) => (
        <button key={o.value} className={(o.value === value ? 'on ' : '') + (o.cls || '')} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.i layoutId={'seg' + id} className="seg-pill" transition={spring} />}
          <span>{o.label}</span>
          {o.count !== undefined && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="tabs">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.i layoutId={'tab' + id} className="tab-pill" transition={spring} />}
          <span>{o.label}</span>
          {o.count !== undefined && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}

// ---------- quantity stepper ----------
export function Stepper({ value, onChange, max, unit = 'шт.' }: { value: number; onChange: (n: number) => void; max?: number; unit?: string }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const clamp = (n: number) => Math.max(1, max ? Math.min(max, n) : n);
  return (
    <div className="stepper">
      <button disabled={value <= 1} onClick={() => onChange(clamp(value - 1))}>−</button>
      <div className="mid">
        <input
          value={txt}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setTxt(v);
            if (v) onChange(clamp(parseInt(v, 10)));
          }}
          onBlur={() => setTxt(String(value))}
        />
        <span>{unit}</span>
      </div>
      <button disabled={max !== undefined && value >= max} onClick={() => onChange(clamp(value + 1))}>+</button>
    </div>
  );
}

// ---------- animated money ----------
export function CountUp({ value, format = money, className }: { value: number; format?: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value, dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value]);
  return <span className={className}>{format(shown)}</span>;
}

// ---------- images ----------
/** In the desktop app, remote images go through the Rust `thumb://` cache that shrinks them to `w` px. */
export function thumbSrc(url: string, w: number): string {
  return isTauri && url.startsWith('https://cdn.ng-gta5.com/') ? `http://thumb.localhost/${w}/${encodeURIComponent(url)}` : url;
}
const withThumbs = (urls: string[], w: number) => urls.flatMap((u) => (thumbSrc(u, w) !== u ? [thumbSrc(u, w), u] : [u]));

export function Thumb({ entry, src, cover, w = 360 }: { entry?: Entry | null; src?: string | null; cover?: boolean; w?: number }) {
  // Try the given/CDN image first (as a cached thumbnail, then raw), then the bundled fallback, then the photo.
  const chain = withThumbs((src !== undefined && src !== null ? [src] : entry ? [entry.img, entry.fallback, entry.photo] : []).filter(Boolean) as string[], w);
  const [idx, setIdx] = useState(0);
  const chainKey = chain.join('|');
  useEffect(() => setIdx(0), [chainKey]);
  const bad = idx >= chain.length;
  const setBad = () => setIdx((i) => i + 1);
  const s = chain[idx] || null;
  const isPhoto = !!entry && !entry.img && !!entry.photo && !!s && (s === entry.photo || s === thumbSrc(entry.photo, w));
  const isCrop = !!s && s.includes('catalog/vehicles/');
  const isCloth = !!s && s.includes('catalog/clothes/');
  if (isCloth && !bad) return <img key={s} src={s!} alt="" loading="lazy" decoding="async" className="cover cloth" onError={setBad} draggable={false} />;
  if (!s || bad) return <span className="ph">{(entry?.name || '?').replace(/^[^\p{L}\d]+/u, '').charAt(0).toUpperCase()}</span>;
  return <img key={s} src={s} alt="" loading="lazy" decoding="async" className={cover || isPhoto ? 'cover' : isCrop ? 'crop' : ''} onError={setBad} draggable={false} />;
}

export function HeartBtn({ id, className = '' }: { id: string; className?: string }) {
  // Plain button + CSS keyframe: hundreds of these render at once, so no framer-motion here.
  const on = useStore((s) => s.favs.includes(id));
  const [popped, setPopped] = useState(false);
  return (
    <button
      className={'heart ' + (on ? 'on ' : '') + (popped ? 'pop ' : '') + className}
      onClick={(e) => { e.stopPropagation(); setPopped(true); actions.toggleFav(id); }}
      title={on ? 'Прибрати з обраного' : 'В обране'}
    >
      <Heart />
    </button>
  );
}

export function Badge({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) return null;
  const r = Math.round(value);
  const cls = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
  return <span className={'badge ' + cls}>{r > 0 ? '+' : r < 0 ? '−' : ''}{Math.abs(r)}%</span>;
}

// ---------- modal ----------
export function Modal({ open, onClose, children, size = '' }: { open: boolean; onClose: () => void; children: ReactNode; size?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            className={'modal ' + size}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ModalHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="modal-head">
      <div>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </div>
      <button className="icon-btn" onClick={onClose}><X /></button>
    </div>
  );
}

// ---------- toasts ----------
type Toast = { id: number; title: string; sub?: string; kind?: 'ok' | 'err'; undo?: () => void };
let toastId = 0;
const tl = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];
export function toast(t: Omit<Toast, 'id'>) {
  const id = ++toastId;
  toasts = [...toasts, { ...t, id }].slice(-4);
  tl.forEach((l) => l(toasts));
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== id); tl.forEach((l) => l(toasts)); }, t.undo ? 6000 : 3200);
}
export function Toasts() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => { tl.add(setList); return () => { tl.delete(setList); }; }, []);
  return (
    <div className="toasts">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={'toast ' + (t.kind === 'err' ? 'err' : '')}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <span className="t-ico">{t.kind === 'err' ? <AlertTriangle /> : <Check />}</span>
            <div className="grow">{t.title}{t.sub && <small>{t.sub}</small>}</div>
            {t.undo && (
              <button className="undo" onClick={() => { t.undo!(); toasts = toasts.filter((x) => x.id !== t.id); tl.forEach((l) => l(toasts)); }}>
                Повернути
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Empty({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="e-ico"><Icon size={26} /></div>
      <h4>{title}</h4>
      <p>{text}</p>
      {children}
    </motion.div>
  );
}

// ---------- charts ----------
export function AreaChart({ data, height = 250, format = money }: { data: { ts: number; v: number; label: string }[]; height?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const pad = { l: 8, r: 8, t: 16, b: 26 };
  const { path, area, pts, zeroY } = useMemo(() => {
    const vals = data.map((d) => d.v);
    let min = Math.min(0, ...vals), max = Math.max(0, ...vals);
    if (max === min) { max += 1; min -= 1; }
    const span = max - min; max += span * 0.08; min -= span * 0.04;
    const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
    const pts = data.map((d, i) => ({
      x: pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw),
      y: pad.t + (1 - (d.v - min) / (max - min)) * ih,
    }));
    const zeroY = pad.t + (1 - (0 - min) / (max - min)) * ih;
    let path = '';
    pts.forEach((p, i) => {
      if (!i) { path += `M${p.x},${p.y}`; return; }
      const p0 = pts[i - 1], cx = (p0.x + p.x) / 2;
      path += ` C${cx},${p0.y} ${cx},${p.y} ${p.x},${p.y}`;
    });
    const area = pts.length ? `${path} L${pts[pts.length - 1].x},${zeroY} L${pts[0].x},${zeroY} Z` : '';
    return { path, area, pts, zeroY };
  }, [data, w, height]);
  const last = data[data.length - 1]?.v ?? 0;
  const color = last < 0 ? 'var(--red)' : 'var(--accent)';
  const ticks = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];
  return (
    <div ref={ref} className="chart-wrap" onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect(); const x = e.clientX - r.left;
        let best = 0, bd = Infinity;
        pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
        setHover(best);
      }}>
      <svg width={w} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={'g' + gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={last < 0 ? '#ff5f6d' : '#2dffbb'} stopOpacity="0.28" />
            <stop offset="100%" stopColor={last < 0 ? '#ff5f6d' : '#2dffbb'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((k) => (
          <line key={k} x1={pad.l} x2={w - pad.r} y1={pad.t + k * (height - pad.t - pad.b)} y2={pad.t + k * (height - pad.t - pad.b)} stroke="rgba(255,255,255,.04)" />
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,.1)" strokeDasharray="3 5" />
        <motion.path key={'a' + data.length + w} d={area} fill={`url(#g${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        <motion.path key={'p' + data.length + w} d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
        {ticks.map((i) => pts[i] && (
          <text key={i} x={pts[i].x} y={height - 6} fill="#5b6067" fontSize="11" fontWeight="600" textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>{data[i].label}</text>
        ))}
        {hover !== null && pts[hover] && (
          <g>
            <line x1={pts[hover].x} x2={pts[hover].x} y1={pad.t} y2={height - pad.b} stroke="rgba(255,255,255,.12)" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r={5} fill="#0c0e12" stroke={color} strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {hover !== null && pts[hover] && (
        <div className="chart-tip" style={{ left: pts[hover].x + 14, top: pts[hover].y + 8 }}>
          <span style={{ color: 'var(--muted)' }}>{data[hover].label}</span>
          <b>{format(data[hover].v)}</b>
        </div>
      )}
    </div>
  );
}
