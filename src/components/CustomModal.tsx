import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Layers, Trash2 } from 'lucide-react';
import { useApp, type CustomPreset } from '../app';
import { SECTIONS } from '../lib/catalog';
import { actions, getState } from '../lib/store';
import { uid } from '../lib/format';
import { Modal, ModalHead, Quick, toast } from './ui';

/** Downscale a picked image to a small webp data URL so the save file stays light. */
function shrink(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 360 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/webp', 0.86));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export function CustomModal({ open, preset, onClose }: { open: boolean; preset?: CustomPreset; onClose: () => void }) {
  const { go, openDeal } = useApp();
  const [name, setName] = useState('');
  const [section, setSection] = useState('items');
  const [cat, setCat] = useState('');
  const [img, setImg] = useState<string | undefined>();
  const file = useRef<HTMLInputElement>(null);
  const edit = preset?.edit ? getState().custom.find((c) => c.id === preset.edit) : undefined;

  useEffect(() => {
    if (!open) return;
    setName(edit?.name || '');
    setSection(edit?.section || preset?.section || 'items');
    setCat(edit?.cat || '');
    setImg(edit?.img);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function pick(f?: File | null) {
    if (!f) return;
    try { setImg(await shrink(f)); } catch { toast({ title: 'Не вдалося відкрити зображення', kind: 'err' }); }
  }

  function save() {
    if (!name.trim()) return;
    if (edit) {
      actions.updateCustom({ ...edit, name: name.trim(), section, cat: cat.trim(), img });
      toast({ title: 'Збережено', sub: name.trim() });
      onClose();
      return;
    }
    const c = { id: 'u:' + uid(), name: name.trim(), section, cat: cat.trim(), img, created: Date.now() };
    actions.addCustom(c);
    toast({ title: 'Предмет додано', sub: `${name.trim()} · ${SECTIONS.find((s) => s.key === section)?.title}` });
    onClose();
    setTimeout(() => openDeal({ entry: { id: c.id, kind: 'custom', name: c.name, section, cat: c.cat || 'Свої', img: img || null, order: -1 } }), 120);
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHead title={edit ? 'Редагувати предмет' : 'Свій предмет'} sub="Будинок, бізнес, номер, тачка з тюнінгом — що завгодно" onClose={onClose} />
      <div className="modal-body" onPaste={(e) => pick(e.clipboardData.files?.[0])}>
        <div className="uploader" onClick={() => file.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
          {img ? <img src={img} alt="" /> : <div><ImagePlus size={26} />Фото: клік, перетягніть або Ctrl+V</div>}
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div className="field" style={{ marginTop: 16 }}>
          <label>Назва</label>
          <input className="input" autoFocus placeholder="Наприклад: Будинок #588" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'flex-end' }}>
          <div className="field">
            <label>Розділ</label>
            <Quick icon={Layers} label="Розділ" value={section} onChange={setSection} options={SECTIONS.map((s) => ({ value: s.key, label: s.title }))} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>Підпис / категорія</label>
          <input className="input" placeholder="Комфорт+, Люкс, Тюнінг Stage 3…" value={cat} onChange={(e) => setCat(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        {edit && (
          <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => {
            const snapshot = edit;
            actions.removeCustom(edit.id);
            onClose();
            go({ name: 'custom' });
            toast({ title: 'Предмет видалено', sub: 'Угоди з ним залишились', undo: () => actions.addCustom(snapshot) });
          }}><Trash2 /> Видалити</button>
        )}
        <button className="btn btn-ghost" onClick={onClose}>Скасувати</button>
        <button className="btn btn-solid" disabled={!name.trim()} onClick={save}>{edit ? 'Зберегти' : 'Додати'}</button>
      </div>
    </Modal>
  );
}
