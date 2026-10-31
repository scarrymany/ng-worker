import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { ArrowUpDown, LayoutGrid, Plus, Search, Users, Heart, PackagePlus } from 'lucide-react';
import { Top, useApp } from '../app';
import { ITEM_CATS, sectionByKey, type Entry } from '../lib/catalog';
import { useStore } from '../lib/store';
import { plural } from '../lib/format';
import { EntryCard, marginPct } from '../components/EntryCard';
import { Empty, Quick } from '../components/ui';

type Sort = 'default' | 'az' | 'za' | 'profit' | 'stock';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'default', label: 'Мої спершу' },
  { value: 'az', label: 'А → Я' },
  { value: 'za', label: 'Я → А' },
  { value: 'profit', label: 'Прибуток' },
  { value: 'stock', label: 'На складі' },
];
const CUSTOM_FIRST = new Set(['realty', 'business', 'atm', 'services', 'plates', 'sim']);

export function CatalogPage({ mode, sectionKey }: { mode: 'section' | 'favs' | 'custom'; sectionKey?: string }) {
  const { catalog, ledger, go, openCustom } = useApp();
  const favs = useStore((s) => s.favs);
  const [cat, setCat] = useState('all');
  const [gender, setGender] = useState('all');
  const [sort, setSort] = useState<Sort>('default');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const section = sectionKey ? sectionByKey(sectionKey) : null;

  const base = useMemo(() => {
    if (mode === 'favs') return catalog.filter((e) => favs.includes(e.id));
    if (mode === 'custom') return catalog.filter((e) => e.kind === 'custom');
    return catalog.filter((e) => e.section === sectionKey);
  }, [catalog, favs, mode, sectionKey]);

  const cats = useMemo(() => {
    if (sectionKey === 'items') return ITEM_CATS.filter((c) => base.some((e) => e.cat === c));
    return [...new Set(base.map((e) => e.cat))].sort((a, b) => a.localeCompare(b, 'uk'));
  }, [base, sectionKey]);

  const list = useMemo(() => {
    const s = dq.trim().toLowerCase();
    const st = (e: Entry) => ledger.items.get(e.id);
    const out = base.filter((e) =>
      (cat === 'all' || e.cat === cat) &&
      (gender === 'all' || e.gender === gender) &&
      (!s || e.name.toLowerCase().includes(s) || e.real?.toLowerCase().includes(s)),
    );
    const by: Record<Sort, (a: Entry, b: Entry) => number> = {
      default: (a, b) => (st(b)?.lastTs || 0) - (st(a)?.lastTs || 0) || a.order - b.order,
      az: (a, b) => a.name.localeCompare(b.name, 'uk'),
      za: (a, b) => b.name.localeCompare(a.name, 'uk'),
      profit: (a, b) => (st(b)?.realized || 0) - (st(a)?.realized || 0) || (marginPct(st(b)) || 0) - (marginPct(st(a)) || 0),
      stock: (a, b) => (st(b)?.held || 0) - (st(a)?.held || 0) || a.order - b.order,
    };
    return out.sort(by[sort]);
  }, [base, cat, gender, dq, sort, ledger]);

  const open = useCallback((id: string) => go({ name: 'item', id }), [go]);
  const title = mode === 'favs' ? 'Обране' : mode === 'custom' ? 'Свої предмети' : section!.title;
  const showAdd = mode === 'custom' || (sectionKey && CUSTOM_FIRST.has(sectionKey));
  const filterIcon = section?.icon || LayoutGrid;

  return (
    <>
      <Top title={title} sub={`${list.length} ${plural(list.length, 'позиція', 'позиції', 'позицій')}`}>
        {cats.length > 1 && (
          <Quick icon={filterIcon} label={section?.filterLabel || 'Розділ'} value={cat} onChange={setCat}
            options={[{ value: 'all', label: 'Усі' }, ...cats.map((c) => ({ value: c, label: c, count: base.filter((e) => e.cat === c).length }))]} />
        )}
        {sectionKey === 'clothes' && (
          <Quick icon={Users} label="Стать" value={gender} onChange={setGender}
            options={[{ value: 'all', label: 'Усі' }, { value: 'Чоловіча', label: 'Чоловіча' }, { value: 'Жіноча', label: 'Жіноча' }]} />
        )}
        <Quick icon={ArrowUpDown} label="Сортувати" value={sort} onChange={setSort} options={SORTS} />
        <label className="search">
          <Search />
          <input placeholder={sectionKey === 'vehicles' ? 'Модель або прототип' : 'Назва'} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </Top>
      <div className="page">
        {list.length === 0 && !showAdd ? (
          mode === 'favs' ? (
            <Empty icon={Heart} title="Поки порожньо" text="Тисніть сердечко на картці, щоб тримати потрібні предмети під рукою." />
          ) : (
            <Empty icon={Search} title="Нічого не знайдено" text="Спробуйте іншу назву або скиньте фільтри." />
          )
        ) : (
          <div className="grid">
            {showAdd && (
              <button className="card add" onClick={() => openCustom({ section: sectionKey })}>
                <span className="plus"><Plus size={24} /></span>
                {mode === 'custom' ? 'Новий предмет' : `Додати: ${section?.singular.toLowerCase()}`}
              </button>
            )}
            {list.map((e, i) => (
              <EntryCard key={e.id} e={e} s={ledger.items.get(e.id)} i={i} onOpen={open} />
            ))}
          </div>
        )}
        {showAdd && list.length === 0 && (
          <Empty icon={PackagePlus} title="Тут поки нічого" text="Цього немає в базі гри — додайте свій запис з фото, і він з'явиться тут та в пошуку угод." />
        )}
      </div>
    </>
  );
}
