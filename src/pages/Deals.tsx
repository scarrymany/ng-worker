import { useDeferredValue, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Filter, Pencil, Search, Trash2, ArrowLeftRight } from 'lucide-react';
import { Top, useApp } from '../app';
import { useStore, type Deal } from '../lib/store';
import { dateTime, money, plural, signedMoney } from '../lib/format';
import { Empty, Quick, Thumb } from '../components/ui';
import { deleteDealWithUndo } from '../components/DealModal';

type TypeF = 'all' | 'buy' | 'sell';
type Period = 'all' | 'today' | '7' | '30';

export function DealsTable({ deals, showItem = true, limit }: { deals: Deal[]; showItem?: boolean; limit?: number }) {
  const { byId, ledger, go, openDeal } = useApp();
  const rows = limit ? deals.slice(0, limit) : deals;
  return (
    <div className="table-scroll">
    <table className="table">
      <thead>
        <tr>
          {showItem && <th>Предмет</th>}
          <th>Тип</th>
          <th>Дата</th>
          <th className="r">Кількість</th>
          <th className="r">Ціна за 1 шт.</th>
          <th className="r">Сума</th>
          <th className="r">Прибуток</th>
          <th style={{ width: 80 }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((d, i) => {
          const e = byId.get(d.itemId);
          const p = ledger.dealProfit.get(d.id);
          const sum = d.qty * d.price + (d.type === 'buy' ? d.fee : -d.fee);
          return (
            <motion.tr key={d.id} className={showItem ? 'click' : ''}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.018, duration: 0.3 }}
              onClick={() => showItem && go({ name: 'item', id: d.itemId })}>
              {showItem && (
                <td>
                  <div className="row-item">
                    <div className="row-thumb"><Thumb w={160} entry={e} src={d.variant !== undefined && e?.variants ? e.variants[d.variant] : undefined} /></div>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ display: 'block' }}>{e?.name || d.name}</b>
                      {d.note && <span className="muted" style={{ fontSize: 12 }}>{d.note}</span>}
                    </div>
                  </div>
                </td>
              )}
              <td>
                {d.type === 'buy'
                  ? <span className="pill buy"><ArrowDownLeft />Купівля</span>
                  : <span className="pill sell"><ArrowUpRight />Продаж</span>}
              </td>
              <td className="muted">{dateTime(d.ts)}</td>
              <td className="r">{d.qty} шт.</td>
              <td className="r">{money(d.price)}</td>
              <td className="r">{d.type === 'buy' ? '−' : '+'}{money(sum)}</td>
              <td className="r">{p === undefined ? <span className="muted">—</span> : <span className={p >= 0 ? 'pos' : 'neg'}>{signedMoney(p)}</span>}</td>
              <td>
                <div className="row-actions">
                  <button className="icon-btn" title="Редагувати" onClick={(ev) => { ev.stopPropagation(); openDeal({ deal: d }); }}><Pencil /></button>
                  <button className="icon-btn del" title="Видалити" onClick={(ev) => { ev.stopPropagation(); deleteDealWithUndo(d.id); }}><Trash2 /></button>
                </div>
              </td>
            </motion.tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

export function Deals() {
  const { ledger, openDeal } = useApp();
  const deals = useStore((s) => s.deals);
  const [type, setType] = useState<TypeF>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);

  const list = useMemo(() => {
    const now = Date.now();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const from = period === 'today' ? start.getTime() : period === '7' ? now - 7 * 864e5 : period === '30' ? now - 30 * 864e5 : 0;
    const s = dq.trim().toLowerCase();
    return deals
      .filter((d) => (type === 'all' || d.type === type) && d.ts >= from && (!s || d.name.toLowerCase().includes(s) || d.note?.toLowerCase().includes(s)))
      .sort((a, b) => b.ts - a.ts);
  }, [deals, type, period, dq]);

  const sum = useMemo(() => {
    let spent = 0, got = 0, profit = 0;
    for (const d of list) {
      if (d.type === 'buy') spent += d.qty * d.price + d.fee;
      else { got += d.qty * d.price - d.fee; profit += ledger.dealProfit.get(d.id) || 0; }
    }
    return { spent, got, profit };
  }, [list, ledger]);

  return (
    <>
      <Top title="Угоди" sub={`${list.length} ${plural(list.length, 'угода', 'угоди', 'угод')}`}>
        <Quick icon={Filter} label="Тип" value={type} onChange={setType}
          options={[{ value: 'all', label: 'Усі' }, { value: 'buy', label: 'Купівля' }, { value: 'sell', label: 'Продаж' }]} />
        <Quick icon={CalendarDays} label="Період" value={period} onChange={setPeriod}
          options={[{ value: 'all', label: 'Весь час' }, { value: 'today', label: 'Сьогодні' }, { value: '7', label: '7 днів' }, { value: '30', label: '30 днів' }]} />
        <label className="search"><Search /><input placeholder="Предмет або нотатка" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </Top>
      <div className="page">
        {deals.length === 0 ? (
          <Empty icon={ArrowLeftRight} title="Ще немає жодної угоди" text="Записуйте кожну купівлю і продаж — застосунок сам порахує собівартість за FIFO, прибуток і що лежить на складі.">
            <button className="btn btn-solid" onClick={() => openDeal()}>Додати першу угоду</button>
          </Empty>
        ) : (
          <>
            <div className="ip-stats" style={{ marginTop: 0, marginBottom: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="ip-stat"><small>Витрачено на купівлю</small><b>{money(sum.spent)}</b></div>
              <div className="ip-stat"><small>Отримано з продажів</small><b>{money(sum.got)}</b></div>
              <div className="ip-stat"><small>Прибуток з продажів</small><b className={sum.profit >= 0 ? 'pos' : 'neg'}>{signedMoney(sum.profit)}</b></div>
            </div>
            <div className="panel" style={{ overflow: 'hidden' }}>
              {list.length ? <DealsTable deals={list} /> : <Empty icon={Search} title="Нічого не знайдено" text="Змініть фільтри або пошук." />}
            </div>
          </>
        )}
      </div>
    </>
  );
}
