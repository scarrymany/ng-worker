import { useCallback, useMemo } from 'react';
import { Archive } from 'lucide-react';
import { Top, useApp } from '../app';
import { money, plural } from '../lib/format';
import { EntryCard } from '../components/EntryCard';
import { CountUp, Empty } from '../components/ui';

export function Stock() {
  const { ledger, byId, go, openDeal } = useApp();
  const held = useMemo(
    () => [...ledger.items.values()].filter((s) => s.held > 0).sort((a, b) => b.heldCost - a.heldCost),
    [ledger],
  );
  const open = useCallback((id: string) => go({ name: 'item', id }), [go]);
  const units = held.reduce((a, s) => a + s.held, 0);
  return (
    <>
      <Top title="Склад" sub={`${held.length} ${plural(held.length, 'позиція', 'позиції', 'позицій')} · ${units} шт.`} />
      <div className="page">
        {!held.length ? (
          <Empty icon={Archive} title="Склад порожній" text="Тут з'являється все, що ви купили і ще не продали — з середньою собівартістю.">
            <button className="btn btn-solid" onClick={() => openDeal({ type: 'buy' })}>Записати купівлю</button>
          </Empty>
        ) : (
          <>
            <div className="ip-stats" style={{ marginTop: 0, marginBottom: 20, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="ip-stat"><small>Вкладено в склад</small><b><CountUp value={ledger.totals.stockCost} /></b></div>
              <div className="ip-stat"><small>Одиниць на складі</small><b>{units} шт.</b></div>
              <div className="ip-stat"><small>Найдорожча позиція</small><b>{held[0].name} · {money(held[0].heldCost)}</b></div>
            </div>
            <div className="grid">
              {held.map((s, i) => {
                const e = byId.get(s.itemId) || { id: s.itemId, kind: 'custom' as const, name: s.name, section: 'items', cat: 'Видалений предмет', order: 0 };
                return <EntryCard key={s.itemId} e={e} s={s} i={i} onOpen={open} />;
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
