import { memo } from 'react';
import { Archive, Palette, Sparkles } from 'lucide-react';
import type { Entry } from '../lib/catalog';
import type { ItemStats } from '../lib/ledger';
import { money, plural } from '../lib/format';
import { Badge, HeartBtn, Thumb } from './ui';

export function subtitle(e: Entry): string {
  if (e.kind === 'vehicle') return e.real || (e.guess ? `${e.cat} · назва орієнтовна` : e.cat);
  if (e.kind === 'clothes') return `${e.cat} · ${e.gender}`;
  if (e.kind === 'item' && e.guess) return `${e.cat} · назва орієнтовна`;
  if (e.kind === 'custom') return e.cat || 'Свій предмет';
  return e.cat;
}

export function marginPct(s?: ItemStats): number | null {
  if (!s || s.sold <= 0) return null;
  const cost = s.revenue - s.realized;
  if (cost <= 0) return null;
  return (s.realized / cost) * 100;
}

export const EntryCard = memo(function EntryCard({ e, s, i, onOpen }: { e: Entry; s?: ItemStats; i: number; onOpen: (id: string) => void }) {
  const held = s?.held || 0;
  const avg = held > 0 ? s!.heldCost / held : 0;
  return (
    <div className={'card' + (i < 20 ? ' enter' : '')} style={i < 20 ? { animationDelay: `${i * 22}ms` } : undefined} onClick={() => onOpen(e.id)}>
      <div className="well">
        <Thumb entry={e} />
        <HeartBtn id={e.id} />
        {held > 0 ? (
          <span className="chip acc"><Archive />{held} шт.</span>
        ) : e.variants && e.variants.length > 1 ? (
          <span className="chip"><Palette />{e.variants.length} {plural(e.variants.length, 'колір', 'кольори', 'кольорів')}</span>
        ) : e.kind === 'custom' ? (
          <span className="chip"><Sparkles />Свій</span>
        ) : null}
      </div>
      <div className="card-body">
        <div className="card-name">{e.name}</div>
        <div className="card-sub">
          {s && s.deals > 0
            ? held > 0
              ? `${held} шт. на складі`
              : `${s.deals} ${plural(s.deals, 'угода', 'угоди', 'угод')}`
            : subtitle(e)}
        </div>
        <div className="card-foot">
          {s && s.deals > 0 ? (
            <span className="card-price">
              <small>{held > 0 ? 'сер.' : 'ост.'}</small>
              {money(held > 0 ? avg : s.lastPrice)}
            </span>
          ) : (
            <span className="card-price none">Немає угод</span>
          )}
          <Badge value={marginPct(s)} />
        </div>
      </div>
    </div>
  );
});
