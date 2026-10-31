import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowDownLeft, ArrowUpRight, PackagePlus } from 'lucide-react';
import { useApp, type DealPreset } from '../app';
import { SECTIONS, type Entry } from '../lib/catalog';
import { actions, useStore, type DealType } from '../lib/store';
import { money, parseAmount, signedMoney, uid, plural } from '../lib/format';
import { Modal, ModalHead, Seg, Stepper, Thumb, thumbSrc, toast } from './ui';
import { subtitle } from './EntryCard';

const toLocal = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function DealModal({ open, preset, onClose }: { open: boolean; preset?: DealPreset; onClose: () => void }) {
  const { catalog, byId, ledger, openCustom } = useApp();
  const defFee = useStore((s) => s.settings.fee);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [q, setQ] = useState('');
  const [sec, setSec] = useState('all');
  const [type, setType] = useState<DealType>('buy');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('0');
  const [when, setWhen] = useState(toLocal(Date.now()));
  const [note, setNote] = useState('');
  const [variant, setVariant] = useState<number | undefined>();
  const editing = preset?.deal;

  useEffect(() => {
    if (!open) return;
    const d = preset?.deal;
    const e = d ? byId.get(d.itemId) || null : preset?.entry || null;
    setEntry(e);
    setQ('');
    setSec('all');
    setType(d?.type || preset?.type || 'buy');
    setQty(d?.qty || preset?.qty || 1);
    setPrice(d ? String(d.price) : preset?.price ? String(preset.price) : '');
    const t = d?.type || preset?.type || 'buy';
    setFee(d ? (d.qty * d.price > 0 ? String(Math.round((d.fee / (d.qty * d.price)) * 1000) / 10) : '0') : t === 'sell' ? String(defFee) : '0');
    setWhen(toLocal(d?.ts || Date.now()));
    setNote(d?.note || '');
    setVariant(d?.variant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = catalog.filter((e) => (sec === 'all' || e.section === sec) && (!s || e.name.toLowerCase().includes(s) || e.real?.toLowerCase().includes(s)));
    // Items you already trade come first.
    return list
      .map((e) => ({ e, w: (ledger.items.get(e.id)?.lastTs || 0) + (s && e.name.toLowerCase().startsWith(s) ? 1e15 : 0) }))
      .sort((a, b) => b.w - a.w || a.e.order - b.e.order)
      .slice(0, 60)
      .map((x) => x.e);
  }, [catalog, q, sec, ledger]);

  const st = entry ? ledger.items.get(entry.id) : undefined;
  const unit = parseAmount(price);
  const total = isFinite(unit) ? unit * qty : 0;
  const feePct = parseFloat(fee.replace(',', '.')) || 0;
  const feeAbs = Math.round(total * feePct) / 100;
  const avgCost = st && st.held > 0 ? st.heldCost / st.held : 0;
  const estProfit = type === 'sell' && avgCost ? total - feeAbs - avgCost * Math.min(qty, st!.held) : null;
  const valid = !!entry && qty >= 1 && isFinite(unit) && unit >= 0 && price.trim() !== '';

  function submit() {
    if (!valid || !entry) return;
    const deal = {
      id: editing?.id || uid(), type, itemId: entry.id, name: entry.name, qty, price: unit, fee: feeAbs,
      ts: new Date(when).getTime() || Date.now(), note: note.trim() || undefined, variant,
    };
    if (editing) actions.updateDeal(deal);
    else actions.addDeal(deal);
    toast({
      title: editing ? 'Угоду оновлено' : type === 'buy' ? `Купівлю записано: ${entry.name}` : `Продаж записано: ${entry.name}`,
      sub: `${qty} шт. × ${money(unit)} = ${money(total)}`,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHead title={editing ? 'Редагувати угоду' : 'Нова угода'} sub={entry ? undefined : 'Оберіть предмет, транспорт або щось своє'} onClose={onClose} />
      <div className="modal-body">
        {!entry ? (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="search" style={{ flex: 1, width: 'auto' }}>
                <Search />
                <input autoFocus placeholder="Назва предмета, моделі…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button className="btn btn-ghost" onClick={() => { onClose(); openCustom(); }}><PackagePlus /> Свій предмет</button>
            </div>
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <Seg
                value={sec}
                onChange={setSec}
                options={[{ value: 'all', label: 'Усе' }, ...SECTIONS.filter((s) => catalog.some((e) => e.section === s.key)).map((s) => ({ value: s.key, label: s.title }))]}
              />
            </div>
            <div className="pick-list">
              {results.map((e, i) => (
                <motion.button key={e.id} className="pick" onClick={() => setEntry(e)}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 18) * 0.012 }}>
                  <div className="row-thumb"><Thumb entry={e} w={160} /></div>
                  <div>
                    <b>{e.name}</b>
                    <small>{ledger.items.get(e.id)?.held ? `${ledger.items.get(e.id)!.held} шт. на складі` : subtitle(e)}</small>
                  </div>
                </motion.button>
              ))}
              {!results.length && <div style={{ gridColumn: '1/-1', color: 'var(--muted)', padding: 30, textAlign: 'center', fontWeight: 600 }}>Нічого не знайдено. Додайте свій предмет.</div>}
            </div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="chosen">
              <div className="row-thumb"><Thumb w={160} entry={entry} src={variant !== undefined && entry.variants ? entry.variants[variant] : undefined} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{entry.name}</b>
                <small>{st?.held ? `На складі ${st.held} шт. · сер. ${money(avgCost)}` : subtitle(entry)}</small>
              </div>
              {!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEntry(null)}>Змінити</button>}
            </div>
            {entry.variants && entry.variants.length > 1 && (
              <div className="variants">
                {entry.variants.map((v, k) => (
                  <button key={v} className={'variant' + (variant === k ? ' on' : '')} onClick={() => setVariant(variant === k ? undefined : k)}>
                    <img src={thumbSrc(v, 160)} alt="" loading="lazy" decoding="async" onError={(ev) => { if (ev.currentTarget.src !== v) ev.currentTarget.src = v; }} /><em>{k + 1}</em>
                  </button>
                ))}
              </div>
            )}
            <div className="form-grid">
              <div className="full">
                <Seg
                  className="type"
                  value={type}
                  onChange={(t) => { setType(t); if (!editing) setFee(t === 'sell' ? String(defFee) : '0'); }}
                  options={[
                    { value: 'buy', label: <><ArrowDownLeft size={15} style={{ verticalAlign: -3 }} /> Купив</>, cls: 'buy' },
                    { value: 'sell', label: <><ArrowUpRight size={15} style={{ verticalAlign: -3 }} /> Продав</>, cls: 'sell' },
                  ]}
                />
              </div>
              <div className="field">
                <label>Кількість</label>
                <Stepper value={qty} onChange={setQty} />
              </div>
              <div className="field">
                <label>Ціна за 1 шт. <span style={{ color: 'var(--dim)' }}>· можна «15к», «1.2кк»</span></label>
                <div className="input-wrap">
                  <span className="prefix">$</span>
                  <input className="input" style={{ height: 54, fontSize: 16, fontWeight: 800 }} autoFocus placeholder="0" value={price}
                    onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
                </div>
              </div>
              <div className="field">
                <label>Комісія маркету</label>
                <div className="input-wrap">
                  <input className="input" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.,]/g, ''))} />
                  <span className="suffix">% · {money(feeAbs)}</span>
                </div>
              </div>
              <div className="field">
                <label>Дата і час</label>
                <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div className="field full">
                <label>Нотатка</label>
                <input className="input" placeholder="Кому продав, номер, пробіг…" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <div className="calc-preview" style={{ marginTop: 18 }}>
              <div><span>Сума</span><b>{money(total)}</b></div>
              {feeAbs > 0 && <div><span>Комісія</span><b>−{money(feeAbs)}</b></div>}
              {type === 'sell' && st && qty > st.held && (
                <div><span style={{ color: 'var(--amber)' }}>На складі лише {st.held} {plural(st.held, 'штука', 'штуки', 'штук')} — решта рахується без собівартості</span></div>
              )}
              {estProfit !== null && (
                <div><span>Прибуток з угоди (FIFO ≈)</span><b className={estProfit >= 0 ? 'pos' : 'neg'}>{signedMoney(estProfit)}</b></div>
              )}
            </div>
          </motion.div>
        )}
      </div>
      {entry && (
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Скасувати</button>
          <button className="btn btn-solid" disabled={!valid} onClick={submit}>
            {editing ? 'Зберегти' : type === 'buy' ? `Записати купівлю · ${money(total + feeAbs)}` : `Записати продаж · ${money(total - feeAbs)}`}
          </button>
        </div>
      )}
    </Modal>
  );
}

export function deleteDealWithUndo(id: string) {
  const d = actions.removeDeal(id);
  if (!d) return;
  toast({ title: 'Угоду видалено', sub: `${d.name} · ${d.qty} шт.`, undo: () => actions.addDeal(d) });
}
