import { useEffect, useState } from 'react';
import { Download, Upload, FolderOpen, Trash2, RefreshCw } from 'lucide-react';
import { Top } from '../app';
import { actions, dataLocation, exportBackup, getState, pickBackup, scanGameCache, useStore, type State } from '../lib/store';
import { entryFromUrl } from '../lib/catalog';
import { Modal, ModalHead, toast } from '../components/ui';
import { plural } from '../lib/format';

export function SettingsPage() {
  const s = useStore((x) => x.settings);
  const counts = { d: useStore((x) => x.deals.length), c: useStore((x) => x.custom.length) };
  const [loc, setLoc] = useState('');
  const [nick, setNick] = useState(s.nick);
  const [fee, setFee] = useState(String(s.fee));
  const [pending, setPending] = useState<State | null>(null);
  const [wipe, setWipe] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const discoveredCount = useStore((x) => x.discovered.length);
  useEffect(() => { dataLocation().then(setLoc); }, []);

  return (
    <>
      <Top title="Налаштування" sub="Профіль, комісія, резервні копії" />
      <div className="page">
        <div className="set-grid">
          <div className="panel set-card">
            <h3>Профіль</h3>
            <p>Ініціали показуються в кружечку справа зверху.</p>
            <div className="field">
              <label>Нікнейм</label>
              <input className="input" value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} onBlur={() => actions.settings({ nick: nick.trim() || 'NG' })} />
            </div>
          </div>
          <div className="panel set-card">
            <h3>Комісія маркету</h3>
            <p>Підставляється за замовчуванням у кожен продаж і віднімається з виручки. 0 — якщо комісії немає.</p>
            <div className="field">
              <label>Відсоток з продажу</label>
              <div className="input-wrap">
                <input className="input" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.,]/g, ''))}
                  onBlur={() => { const v = Math.max(0, Math.min(100, parseFloat(fee.replace(',', '.')) || 0)); setFee(String(v)); actions.settings({ fee: v }); }} />
                <span className="suffix">%</span>
              </div>
            </div>
          </div>
          <div className="panel set-card">
            <h3>Резервна копія</h3>
            <p>Зберігає всі угоди, свої предмети й обране в один .json файл. Застосунок також сам робить щоденну копію (останні 10 днів).</p>
            <div className="set-row">
              <button className="btn btn-solid" onClick={async () => {
                try { const p = await exportBackup(); if (p) toast({ title: 'Копію збережено', sub: p }); } catch (e) { toast({ title: 'Не вдалося зберегти', sub: String(e), kind: 'err' }); }
              }}><Download /> Експорт</button>
              <button className="btn btn-ghost" onClick={async () => {
                try { const st = await pickBackup(); if (st) setPending(st); } catch (e) { toast({ title: 'Файл не підходить', sub: String(e), kind: 'err' }); }
              }}><Upload /> Імпорт</button>
            </div>
          </div>
          <div className="panel set-card">
            <h3>Синхронізувати з грою</h3>
            <p>Читає кеш лаунчера NG на цьому ПК (тільки читання, гра не чіпається) і додає в каталог нові предмети, авто та будинки, які ви бачили в грі. Назви нових можна змінити на сторінці предмета.</p>
            <div className="set-row" style={{ alignItems: 'center' }}>
              <button className="btn btn-solid" disabled={syncing} onClick={async () => {
                setSyncing(true);
                try {
                  const urls = await scanGameCache();
                  const fresh = urls.filter((u) => entryFromUrl(u) && !getState().discovered.includes(u));
                  actions.addDiscovered(fresh);
                  toast({ title: fresh.length ? `Додано нових: ${fresh.length}` : 'Нового нічого немає', sub: `Знайдено в кеші гри: ${urls.length}` });
                } catch (e) {
                  toast({ title: 'Не вдалося прочитати кеш гри', sub: String(e), kind: 'err' });
                } finally { setSyncing(false); }
              }}><RefreshCw className={syncing ? 'spin' : ''} /> {syncing ? 'Сканую…' : 'Синхронізувати'}</button>
              {discoveredCount > 0 && <span className="kbd-hint">Уже додано з гри: {discoveredCount}</span>}
            </div>
          </div>
          <div className="panel set-card">
            <h3>Де лежать дані</h3>
            <p>{counts.d} {plural(counts.d, 'угода', 'угоди', 'угод')}, {counts.c} {plural(counts.c, 'свій предмет', 'своїх предмети', 'своїх предметів')}. Усе зберігається локально на цьому ПК.</p>
            <div className="mono"><FolderOpen size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{loc}</div>
            <div className="set-row" style={{ marginTop: 14 }}>
              <button className="btn btn-danger" onClick={() => setWipe(true)}><Trash2 /> Очистити всі угоди</button>
            </div>
          </div>
        </div>
        <p className="kbd-hint" style={{ marginTop: 24 }}>NG Worker v1.0.0 · фанатський інструмент, не пов'язаний з адміністрацією NG. Фото предметів — з вікі NG, авто та одяг — з NG Base.</p>
      </div>

      <Modal open={!!pending} onClose={() => setPending(null)} size="sm">
        <ModalHead title="Імпортувати копію?" sub="Поточні дані буде замінено вмістом файлу" onClose={() => setPending(null)} />
        <div className="modal-body" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13 }}>
          У файлі: {pending?.deals.length} угод, {pending?.custom.length} своїх предметів. Перед заміною зробіть експорт, якщо поточні дані потрібні.
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={() => setPending(null)}>Скасувати</button>
          <button className="btn btn-solid" onClick={() => { actions.replaceAll(pending!); setPending(null); toast({ title: 'Дані імпортовано' }); }}>Замінити</button>
        </div>
      </Modal>

      <Modal open={wipe} onClose={() => setWipe(false)} size="sm">
        <ModalHead title="Видалити всі угоди?" sub="Свої предмети й обране залишаться" onClose={() => setWipe(false)} />
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={() => setWipe(false)}>Скасувати</button>
          <button className="btn btn-danger" onClick={() => {
            const snapshot = getState();
            actions.replaceAll({ ...snapshot, deals: [] });
            setWipe(false);
            toast({ title: 'Угоди видалено', undo: () => actions.replaceAll(snapshot) });
          }}><Trash2 /> Видалити</button>
        </div>
      </Modal>
    </>
  );
}
