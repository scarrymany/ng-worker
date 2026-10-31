import type { Deal } from './store';
import { dayKey } from './format';

export interface ItemStats {
  itemId: string;
  name: string;
  held: number;
  heldCost: number; // cost basis of what's still in stock
  bought: number;
  sold: number;
  spent: number;
  revenue: number;
  realized: number;
  fees: number;
  lastPrice: number;
  lastBuy: number;
  lastSell: number;
  lastTs: number;
  deals: number;
}

export interface Ledger {
  items: Map<string, ItemStats>;
  dealProfit: Map<string, number>; // sell deal id -> realized profit
  totals: {
    realized: number; revenue: number; spent: number; stockCost: number; fees: number;
    deals: number; buys: number; sells: number; wins: number; heldQty: number;
  };
}

/** FIFO matching of sells against earlier buys, per item. */
export function computeLedger(deals: Deal[]): Ledger {
  const sorted = [...deals].sort((a, b) => a.ts - b.ts);
  const lots = new Map<string, { qty: number; unit: number }[]>();
  const items = new Map<string, ItemStats>();
  const dealProfit = new Map<string, number>();
  const t = { realized: 0, revenue: 0, spent: 0, stockCost: 0, fees: 0, deals: 0, buys: 0, sells: 0, wins: 0, heldQty: 0 };

  for (const d of sorted) {
    let st = items.get(d.itemId);
    if (!st) {
      st = { itemId: d.itemId, name: d.name, held: 0, heldCost: 0, bought: 0, sold: 0, spent: 0, revenue: 0, realized: 0, fees: 0, lastPrice: 0, lastBuy: 0, lastSell: 0, lastTs: 0, deals: 0 };
      items.set(d.itemId, st);
    }
    const q = lots.get(d.itemId) || [];
    lots.set(d.itemId, q);
    st.deals++;
    st.lastPrice = d.price;
    st.lastTs = d.ts;
    st.name = d.name;
    t.deals++;
    t.fees += d.fee;
    st.fees += d.fee;
    if (d.type === 'buy') {
      const total = d.qty * d.price + d.fee;
      q.push({ qty: d.qty, unit: total / d.qty });
      st.bought += d.qty;
      st.spent += total;
      st.lastBuy = d.price;
      t.spent += total;
      t.buys++;
    } else {
      let left = d.qty, cost = 0;
      while (left > 0 && q.length) {
        const lot = q[0];
        const take = Math.min(lot.qty, left);
        cost += take * lot.unit;
        lot.qty -= take;
        left -= take;
        if (lot.qty <= 1e-9) q.shift();
      }
      // Sold more than recorded as bought: unknown cost is treated as 0.
      const income = d.qty * d.price - d.fee;
      const profit = income - cost;
      dealProfit.set(d.id, profit);
      st.sold += d.qty;
      st.revenue += income;
      st.realized += profit;
      st.lastSell = d.price;
      t.revenue += income;
      t.realized += profit;
      t.sells++;
      if (profit > 0) t.wins++;
    }
  }
  for (const [id, q] of lots) {
    const st = items.get(id)!;
    st.held = q.reduce((a, l) => a + l.qty, 0);
    st.heldCost = q.reduce((a, l) => a + l.qty * l.unit, 0);
    t.stockCost += st.heldCost;
    t.heldQty += st.held;
  }
  return { items, dealProfit, totals: t };
}

/** Cumulative realized profit by day for the last `days` days (or since first deal when days = 0). */
export function profitSeries(deals: Deal[], ledger: Ledger, days: number) {
  const byDay = new Map<string, number>();
  for (const d of deals) {
    const p = ledger.dealProfit.get(d.id);
    if (p === undefined) continue;
    const k = dayKey(d.ts);
    byDay.set(k, (byDay.get(k) || 0) + p);
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let span = days;
  if (!days) {
    const first = deals.reduce((m, d) => Math.min(m, d.ts), Date.now());
    span = Math.max(7, Math.ceil((now.getTime() - first) / 86400000) + 1);
  }
  const start = now.getTime() - (span - 1) * 86400000;
  let before = 0;
  for (const d of deals) {
    const p = ledger.dealProfit.get(d.id);
    if (p !== undefined && d.ts < start) before += p;
  }
  const out: { ts: number; day: number; cum: number }[] = [];
  let cum = before;
  for (let i = 0; i < span; i++) {
    const ts = start + i * 86400000;
    const v = byDay.get(dayKey(ts)) || 0;
    cum += v;
    out.push({ ts, day: v, cum });
  }
  return out;
}
