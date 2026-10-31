import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, SlidersHorizontal, ArrowLeftRight } from 'lucide-react';
import { Top, useApp } from '../app';
import { heroOf, sectionByKey, type Entry } from '../lib/catalog';
import { actions, useStore } from '../lib/store';
import { money, parseAmount, plural, signedMoney, uid, dateLong } from '../lib/format';
import { AreaChart, Empty, HeartBtn, Stepper, Tabs, Thumb, thumbSrc, toast } from '../components/ui';
import { DealsTable } from './Deals';
import { subtitle } from '../components/EntryCard';

export function ItemPage({ id }: { id: string }) {
  const { byId, ledger, openDeal, openCustom } = useApp();
  const allDeals = useStore((s) => s.deals);
  const fee = useStore((s) => s.settings.fee);
  const stName = ledger.items.get(id)?.name;
  const e: Entry = byId.get(id) || { id, kind: 'custom', name: stName || 'Видалений предмет', section: 'items', cat: 'Видалений предмет', order: 0 };
  const st = ledger.items.get(id);
  const deals = useMemo(() => allDeals.filter((d) => d.itemId === id).sort((a, b) => b.ts - a.ts), [allDeals, id]);
  const [tab, setTab] = useState<'deals' | 'price' | 'specs'>(e.specs?.length ? 'specs' : 'deals');
  const [variant, setVariant] = useState<number | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const saveName = () => {
    if (!renaming) return;
    setRenaming(false);
    if (newName.trim() && newName.trim() !== e.name) {
      actions.rename(e.id, newName);
      toast({ title: 'Назву змінено', sub: newName.trim() });
    }
  };
  const [price, setPrice] = useState(st?.lastPrice ? String(st.lastPrice) : '');
  const sec = sectionByKey(e.section);
  const held = st?.held || 0;
  const avg = held ? st!.heldCost / held : 0;
  const unit = parseAmount(price);
  const total = isFinite(unit) ? unit * qty : 0;
  const ok = isFinite(unit) && unit >= 0 && price.trim() !== '';
  const sellFee = Math.round(total * fee) / 100;
  const estProfit = avg ? total - sellFee - avg * Math.min(qty, held) : null;
  const img = variant !== undefined && e.variants ? e.variants[variant] : undefined;

  const priceSeries = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' });
    return [...deals].reverse().map((d) => ({ ts: d.ts, v: d.price, label: fmt.format(d.ts) + (d.type === 'buy' ? ' · куп.' : ' · прод.') }));
  }, [deals]);

  function quick(type: 'buy' | 'sell') {
    if (!ok) return;
    const f = type === 'sell' ? sellFee : 0;
    actions.addDeal({ id: uid(), type, itemId: e.id, name: e.name, qty, price: unit, fee: f, ts: Date.now(), variant });
    toast({ title: type === 'buy' ? `Куплено: ${e.name}` : `Продано: ${e.name}`, sub: `${qty} шт. × ${money(unit)}${type === 'sell' && estProfit !== null ? ` · ${signedMoney(estProfit)}` : ''}` });
    setQty(1);
  }

  const hint = (() => {
    if (!ok || !unit) return null;
    if (avg) {
      const diff = ((unit - avg) / avg) * 100;
      if (Math.abs(diff) < 1) return <>Ціна дорівнює вашій собівартості ({money(avg)}).</>;
      return diff > 0
        ? <>Продаж за цією ціною — <span className="g">+{Math.round(diff)}%</span> до вашої собівартості ({money(avg)}).</>
        : <>Це <span className="r">на {Math.round(-diff)}% нижче</span> вашої собівартості ({money(avg)}) — продаж буде в мінус.</>;
    }
    if (st?.lastSell) {
      const diff = ((unit - st.lastSell) / st.lastSell) * 100;
      if (Math.abs(diff) >= 1) return <>Ваш останній продаж був за {money(st.lastSell)} ({diff > 0 ? <span className="r">ця ціна вища на {Math.round(diff)}%</span> : <span className="g">ця ціна нижча на {Math.round(-diff)}%</span>}).</>;
    }
    return null;
  })();

  const tabs = [
    ...(e.specs?.length ? [{ value: 'specs' as const, label: 'Характеристики' }] : []),
    { value: 'deals' as const, label: 'Мої угоди', count: deals.length },
    { value: 'price' as const, label: 'Ціна по угодах' },
  ];

  return (
    <>
      <Top back title={e.name} sub={sec.title} />
      <div className="page">
        <div className="ip">
          <div style={{ minWidth: 0 }}>
            <motion.div className="ip-head" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="ip-img">
                <AnimatePresence mode="wait">
                  <motion.div key={img || 'base'} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                    style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                    <Thumb entry={e} w={560} src={img} cover={!e.img && !!e.photo} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="ip-title" style={{ minWidth: 0, flex: 1 }}>
                {renaming ? (
                  <input className="input rename-input" autoFocus value={newName} onChange={(ev) => setNewName(ev.target.value)}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') saveName(); if (ev.key === 'Escape') setRenaming(false); }} onBlur={saveName} />
                ) : <h2>{e.name}</h2>}
                <span>{subtitle(e)}{e.variants ? ` · ${e.variants.length} ${plural(e.variants.length, 'колір', 'кольори', 'кольорів')}` : ''}</span>
                {e.guess && !renaming && <span className="guess">Назва орієнтовна — натисніть олівець, щоб виправити</span>}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
                {e.kind === 'custom' && byId.has(e.id) ? (
                  <button className="heart" style={{ position: 'static', width: 42, height: 42, borderRadius: 11, background: 'var(--raise)' }} title="Редагувати" onClick={() => openCustom({ edit: e.id })}><Pencil /></button>
                ) : byId.has(e.id) && (
                  <button className="heart" style={{ position: 'static', width: 42, height: 42, borderRadius: 11, background: 'var(--raise)' }} title="Перейменувати" onClick={() => { setNewName(e.name); setRenaming(true); }}><Pencil /></button>
                )}
                <HeartBtn id={e.id} />
              </div>
            </motion.div>

            {e.variants && e.variants.length > 1 && (
              <div className="variants">
                {e.variants.map((v, k) => (
                  <motion.button key={v} className={'variant' + (variant === k ? ' on' : '')} onClick={() => setVariant(variant === k ? undefined : k)}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.02 }}>
                    <img src={thumbSrc(v, 160)} alt="" loading="lazy" decoding="async" onError={(ev) => { if (ev.currentTarget.src !== v) ev.currentTarget.src = v; }} /><em>{k + 1}</em>
                  </motion.button>
                ))}
              </div>
            )}

            <div className="ip-stats">
              <div className="ip-stat"><small>На складі</small><b>{held} шт.</b></div>
              <div className="ip-stat"><small>Сер. собівартість</small><b>{avg ? money(avg) : '—'}</b></div>
              <div className="ip-stat"><small>Прибуток</small><b className={(st?.realized || 0) >= 0 ? 'pos' : 'neg'}>{st?.sold ? signedMoney(st.realized) : '—'}</b></div>
              <div className="ip-stat"><small>Куплено / продано</small><b>{st?.bought || 0} / {st?.sold || 0}</b></div>
            </div>

            {e.photo && heroOf(e) && (
              <motion.div className="hero-photo" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
                <img src={e.photo} alt="" />
                {e.desc && <div className="cap">{e.desc}</div>}
              </motion.div>
            )}

            <div style={{ marginTop: 20 }}>
              <Tabs value={tab} onChange={setTab} options={tabs} />
            </div>
            <div className="panel" style={{ marginTop: 12, overflow: 'hidden', minHeight: 160 }}>
              {tab === 'specs' && e.specs && (
                <div className="specs">{e.specs.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
              )}
              {tab === 'deals' && (deals.length ? <DealsTable deals={deals} showItem={false} /> : (
                <Empty icon={ArrowLeftRight} title="Угод ще немає" text="Запишіть купівлю або продаж справа — тут зʼявиться історія." />
              ))}
              {tab === 'price' && (priceSeries.length > 1 ? <div style={{ paddingTop: 14 }}><AreaChart data={priceSeries} height={240} /></div> : (
                <Empty icon={ArrowLeftRight} title="Замало даних" text="Графік зʼявиться після двох і більше угод." />
              ))}
            </div>
          </div>

          <motion.aside className="panel side-panel" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <div className="sp-kicker">{sec.singular}</div>
            <div className="sp-name">{e.name}</div>
            <div className="sp-line">{held ? <>На складі <b>{held} шт.</b> · сер. <b>{money(avg)}</b></> : 'Немає на складі'}</div>
            {st?.lastTs ? <div className="sp-line">Остання угода: <b>{money(st.lastPrice)}</b> · {dateLong(st.lastTs)}</div> : null}
            {hint && <div className="sp-hint">{hint}</div>}
            <div style={{ flex: 1 }} />
            <div className="field">
              <label>Ціна за 1 шт.</label>
              <div className="input-wrap">
                <span className="prefix">$</span>
                <input className="input" style={{ height: 54, fontSize: 16, fontWeight: 800 }} placeholder="0" value={price} onChange={(ev) => setPrice(ev.target.value)} />
              </div>
            </div>
            <div className="field">
              <label style={{ color: '#fff', fontWeight: 700, fontSize: 13.5 }}>Скільки?</label>
              <Stepper value={qty} onChange={setQty} />
            </div>
            <div className="sp-total">
              <span>Разом</span>
              <b>{money(total)}</b>
            </div>
            {estProfit !== null && ok && <div className="calc-preview"><div><span>Якщо продати (комісія {fee}%)</span><b className={estProfit >= 0 ? 'pos' : 'neg'}>{signedMoney(estProfit)}</b></div></div>}
            <div className="sp-actions">
              <button className="btn btn-solid" disabled={!ok} onClick={() => quick('buy')}>Купив {qty} шт.</button>
              <button className="btn btn-outline btn-sq" disabled={!ok} onClick={() => quick('sell')}>Продав</button>
              <button className="btn btn-ghost btn-sq" title="Детально: дата, комісія, нотатка" style={{ width: 46, padding: 0 }}
                onClick={() => openDeal({ entry: e, price: ok ? unit : undefined, qty })}><SlidersHorizontal /></button>
            </div>
          </motion.aside>
        </div>
      </div>
    </>
  );
}
