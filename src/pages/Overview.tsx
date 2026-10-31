import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Wallet, ShoppingCart, Archive, Activity, Plus, Car, Package, Keyboard } from 'lucide-react';
import { Top, useApp } from '../app';
import { profitSeries } from '../lib/ledger';
import { useStore } from '../lib/store';
import { ago, money, pct, plural, signedMoney } from '../lib/format';
import { AreaChart, CountUp, Empty, Seg, Thumb } from '../components/ui';

const fade = (i: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } });

export function Overview() {
  const { ledger, byId, go, openDeal } = useApp();
  const deals = useStore((s) => s.deals);
  const nick = useStore((s) => s.settings.nick);
  const [range, setRange] = useState<'7' | '30' | '0'>('30');
  const t = ledger.totals;

  const { series, periodProfit } = useMemo(() => {
    const s = profitSeries(deals, ledger, Number(range));
    const fmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' });
    return {
      series: s.map((p) => ({ ts: p.ts, v: p.cum, label: fmt.format(p.ts) })),
      periodProfit: s.reduce((a, p) => a + p.day, 0),
    };
  }, [deals, ledger, range]);

  const top = useMemo(() => [...ledger.items.values()].filter((s) => s.sold > 0).sort((a, b) => b.realized - a.realized).slice(0, 6), [ledger]);
  const recent = useMemo(() => [...deals].sort((a, b) => b.ts - a.ts).slice(0, 7), [deals]);
  const maxTop = Math.max(1, ...top.map((s) => Math.abs(s.realized)));
  const roi = t.revenue - t.realized > 0 ? (t.realized / (t.revenue - t.realized)) * 100 : 0;

  if (!deals.length) {
    return (
      <>
        <Top title={`Вітаю, ${nick || 'гравцю'}`} sub="Облік купівель і продажів на маркеті NG" />
        <div className="page">
          <Empty icon={TrendingUp} title="Почніть рахувати свій заробіток" text="Записуйте, що купили і за скільки продали. NG Worker сам рахує собівартість (FIFO), чистий прибуток, оборот і що лежить на складі.">
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-solid" onClick={() => openDeal()}><Plus /> Перша угода</button>
              <button className="btn btn-ghost" onClick={() => go({ name: 'section', key: 'vehicles' })}><Car /> Транспорт</button>
              <button className="btn btn-ghost" onClick={() => go({ name: 'section', key: 'items' })}><Package /> Предмети</button>
            </div>
            <p className="kbd-hint" style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8 }}><Keyboard size={14} /> Ctrl+N — нова угода з будь-якого екрану</p>
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <Top title="Огляд" sub={`${t.deals} ${plural(t.deals, 'угода', 'угоди', 'угод')} · ${t.sells} ${plural(t.sells, 'продаж', 'продажі', 'продажів')}`} />
      <div className="page">
        <div className="kpis">
          <motion.div {...fade(0)} className={'panel kpi hero' + (t.realized < 0 ? ' neg' : '')}>
            <div className="k-label"><TrendingUp />Чистий прибуток</div>
            <div className="k-val"><CountUp value={t.realized} format={signedMoney} /></div>
            <div className="k-sub">Рентабельність {pct(roi)}</div>
          </motion.div>
          <motion.div {...fade(1)} className="panel kpi">
            <div className="k-label"><Wallet />Оборот продажів</div>
            <div className="k-val"><CountUp value={t.revenue} /></div>
            <div className="k-sub">після комісії</div>
          </motion.div>
          <motion.div {...fade(2)} className="panel kpi">
            <div className="k-label"><ShoppingCart />Витрачено</div>
            <div className="k-val"><CountUp value={t.spent} /></div>
            <div className="k-sub">{t.buys} {plural(t.buys, 'купівля', 'купівлі', 'купівель')}</div>
          </motion.div>
          <motion.div {...fade(3)} className="panel kpi" style={{ cursor: 'pointer' }} onClick={() => go({ name: 'stock' })}>
            <div className="k-label"><Archive />На складі</div>
            <div className="k-val"><CountUp value={t.stockCost} /></div>
            <div className="k-sub">{t.heldQty} шт. за собівартістю</div>
          </motion.div>
          <motion.div {...fade(4)} className="panel kpi">
            <div className="k-label"><Activity />Вдалі продажі</div>
            <div className="k-val">{t.sells ? Math.round((t.wins / t.sells) * 100) : 0}%</div>
            <div className="k-sub">{t.wins} з {t.sells} у плюс</div>
          </motion.div>
        </div>

        <div className="ov-grid">
          <motion.div {...fade(5)} className="panel">
            <div className="panel-head">
              <div>
                <h3>Прибуток наростаючим підсумком</h3>
                <span>За період: <b className={periodProfit >= 0 ? 'pos' : 'neg'}>{signedMoney(periodProfit)}</b></span>
              </div>
              <Seg value={range} onChange={setRange} options={[{ value: '7', label: '7 днів' }, { value: '30', label: '30 днів' }, { value: '0', label: 'Увесь час' }]} />
            </div>
            <AreaChart data={series} height={268} format={signedMoney} />
          </motion.div>

          <motion.div {...fade(6)} className="panel" style={{ paddingBottom: 12 }}>
            <div className="panel-head" style={{ paddingBottom: 10 }}><h3>Найприбутковіші</h3><span>за весь час</span></div>
            {top.length ? top.map((s, i) => {
              const e = byId.get(s.itemId);
              return (
                <div key={s.itemId} className="list-row" onClick={() => go({ name: 'item', id: s.itemId })}>
                  <span className="rank">{i + 1}</span>
                  <div className="row-thumb"><Thumb entry={e} /></div>
                  <div className="grow">
                    <b>{e?.name || s.name}</b>
                    <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(4, (Math.abs(s.realized) / maxTop) * 100)}%` }} transition={{ delay: 0.3 + i * 0.06, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} style={s.realized < 0 ? { background: 'var(--red)' } : undefined} /></div>
                  </div>
                  <div className="val"><span className={s.realized >= 0 ? 'pos' : 'neg'}>{signedMoney(s.realized)}</span><small>{s.sold} шт. продано</small></div>
                </div>
              );
            }) : <p style={{ color: 'var(--muted)', padding: '10px 22px', fontWeight: 600, fontSize: 13 }}>Зʼявиться після перших продажів.</p>}
          </motion.div>
        </div>

        <motion.div {...fade(7)} className="panel" style={{ marginTop: 16, paddingBottom: 10 }}>
          <div className="panel-head" style={{ paddingBottom: 8 }}>
            <h3>Останні угоди</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => go({ name: 'deals' })}>Усі угоди</button>
          </div>
          {recent.map((d) => {
            const e = byId.get(d.itemId);
            const p = ledger.dealProfit.get(d.id);
            return (
              <div key={d.id} className="list-row" onClick={() => go({ name: 'item', id: d.itemId })}>
                <div className="row-thumb"><Thumb entry={e} /></div>
                <div className="grow">
                  <b>{e?.name || d.name}</b>
                  <small>{d.type === 'buy' ? 'Купівля' : 'Продаж'} · {d.qty} шт. × {money(d.price)} · {ago(d.ts)}</small>
                </div>
                <div className="val">
                  {d.type === 'buy' ? <span>−{money(d.qty * d.price + d.fee)}</span> : <span>+{money(d.qty * d.price - d.fee)}</span>}
                  {p !== undefined && <small className={p >= 0 ? 'pos' : 'neg'}>{signedMoney(p)} прибуток</small>}
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </>
  );
}
