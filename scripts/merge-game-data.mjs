// Merges game-data/ng-game-extract.json (read from the local NGLauncher cache) into src/data/catalog.json.
// New entries point at cdn.ng-gta5.com images, which the app loads at runtime (immutable HTTP cache),
// so the repo does not carry thousands of server images.
import fs from 'node:fs';

const ex = JSON.parse(fs.readFileSync('game-data/ng-game-extract.json', 'utf8'));
const cat = JSON.parse(fs.readFileSync('src/data/catalog.json', 'utf8'));
const norm = (s) => s.toLowerCase().replace(/[«»"'’ʼ]/g, '').replace(/№/g, 'n°').replace(/[\s\-()]+/g, '');

// ---------- items ----------
const FISHKEYS = ['carp', 'pike', 'perch', 'bass', 'trout', 'salmon', 'tuna', 'marlin', 'shark', 'catfish', 'roach', 'bream', 'herring', 'mackerel', 'flounder', 'eel', 'crab', 'shrimp', 'crucian', 'zander', 'goldfish', 'rudd', 'gudgeon', 'crappie'];
function itemCat(key, name) {
  const k = key.toLowerCase(), n = (name || '').toLowerCase();
  if (/rod|reel|hook|weight|line|mono|braid|fluoro|bait|worm|maggot/.test(k) || /вудк|котушк|гачок|грузил|волосін|черв|опариш/.test(n)) return 'Риболовля';
  if (k.startsWith('ammo')) return 'Боєприпаси';
  if (k.startsWith('weapon')) return 'Зброя';
  if (k.startsWith('seed')) return 'Насіння';
  if (k.startsWith('crop') || /гриб|сироїжк|мухомор|моховик/.test(n)) return 'Врожай';
  if (k.startsWith('fillet') || FISHKEYS.some((f) => k.includes(f)) || /філе|риба/.test(n)) return 'Риба';
  if (/food|drink|cola|water|sandwich|burger|bread|cheese/.test(k)) return 'Їжа';
  if (/med|bandage|adrenal|aid/.test(k)) return 'Медикаменти';
  return 'Різне';
}
function humanKey(key) {
  const m = key.match(/^(.*?)(reel|rod)$/i);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (m && m[1]) return `${m[2].toLowerCase() === 'reel' ? 'Котушка' : 'Вудка'} «${cap(m[1])}»`;
  return cap(key.replace(/[_-]+/g, ' '));
}
const itemsById = new Map(cat.items.map((i) => [i.id, i]));
const itemsByName = new Map(cat.items.map((i) => [norm(i.name), i]));
let addI = 0, updI = 0;
for (const it of ex.items) {
  const name = it.name || humanKey(it.key);
  const hit = itemsById.get(it.key) || (it.name && itemsByName.get(norm(it.name)));
  if (hit) {
    if (!hit.img || hit.img.includes('/m_')) { if (hit.img) hit.fallback = hit.img; hit.img = it.img; updI++; }
    hit.key = it.key;
    continue;
  }
  const e = { id: it.key, name, cat: itemCat(it.key, it.name), img: it.img, key: it.key };
  if (!it.name || it.named_by === 'key') e.guess = true;
  cat.items.push(e); itemsById.set(e.id, e); itemsByName.set(norm(name), e); addI++;
}

// ---------- vehicles ----------
const CLS = { sedan: 'Седан', suv: 'Позашляховик', sport: 'Спорткар', super: 'Суперкар', muscle: 'Маслкар', compact: 'Компакт', compacts: 'Компакт', coupe: 'Купе', off_road: 'Бездоріжжя', sport_classic: 'Класика', van: 'Фургон', commercial: 'Комерційний', emergency: 'Спецслужби', military: 'Військовий', open_wheel: 'Болід', helicopter: 'Гелікоптер', motorcycle: 'Мотоцикл', boat: 'Човен' };
const vType = (v) => v.type === 'bike' ? 'Мото' : v.type === 'heli' || v.type === 'plane' ? 'Авіа' : v.type === 'boat' ? 'Водний' : ['commercial', 'van'].includes(v.cls) ? 'Вантажний' : 'Авто';
const vByName = new Map(cat.vehicles.map((v) => [norm(v.name), v]));
const vIds = new Set(cat.vehicles.map((v) => v.id));
let addV = 0, updV = 0;
for (const v of ex.vehicles) {
  const hit = v.named_by !== 'guess' && v.name ? vByName.get(norm(v.name)) : null;
  const body = CLS[v.cls] || null;
  if (hit) {
    if (hit.img && !hit.img.startsWith('http')) hit.fallback = hit.img;
    hit.img = v.img; hit.key = v.key;
    if (body) hit.body = body;
    if (v.make) hit.make = v.make;
    updV++;
    continue;
  }
  let id = v.key; if (vIds.has(id)) id = 'g_' + v.key;
  const e = { id, name: v.name || v.key, img: v.img, type: vType(v), key: v.key, cat: 'Транспорт' };
  if (body) e.body = body;
  if (v.make) e.make = v.make;
  if (v.named_by === 'guess' || !v.name) e.guess = true;
  cat.vehicles.push(e); vIds.add(id); vByName.set(norm(e.name), e); addV++;
}

// ---------- clothes (group colour textures by drawable) ----------
const SLOT = { acss: 'Аксесуари', backpacks: 'Рюкзаки', bodyarmors: 'Бронежилети', ears: 'Сережки', feet: 'Взуття', glasses: 'Окуляри', head: 'Головні убори', legs: 'Штани', masks: 'Маски', top: 'Верхній одяг', tshirt: 'Футболки', watches: 'Годинники' };
const SLOT1 = { acss: 'Аксесуар', backpacks: 'Рюкзак', bodyarmors: 'Бронежилет', ears: 'Сережки', feet: 'Взуття', glasses: 'Окуляри', head: 'Головний убір', legs: 'Штани', masks: 'Маска', top: 'Верх', tshirt: 'Футболка', watches: 'Годинник' };
const groups = new Map();
for (const u of ex.clothes_images) {
  const [, , , g, slot, pack, draw, tex] = u.split('/');
  const k = [g, slot, pack, draw].join('/');
  if (!groups.has(k)) groups.set(k, { g, slot, pack, draw, tex: [] });
  groups.get(k).tex.push({ n: parseInt(tex, 10), u });
}
cat.clothes = (cat.clothes || []).filter((c) => !c.id.startsWith('g_'));
for (const x of groups.values()) {
  x.tex.sort((a, b) => a.n - b.n);
  const gender = x.g === 'clothes_male' ? 'Чоловіча' : 'Жіноча';
  const packShort = x.pack.replace(/^(mp_[mf]_|male_freemode_|female_freemode_)/, '').replace(/_/g, ' ');
  cat.clothes.push({
    id: `g_${x.g === 'clothes_male' ? 'm' : 'f'}_${x.slot}_${x.pack}_${x.draw}`,
    name: `${SLOT1[x.slot] || x.slot} #${x.draw}`,
    cat: 'Одяг та аксесуари', sub: SLOT[x.slot] || x.slot, gender, pack: packShort,
    img: x.tex[0].u, variants: x.tex.map((t) => t.u),
  });
}

// ---------- properties ----------
cat.properties = ex.properties_images.map((u) => {
  const [, , , , kind, file] = u.split('/');
  const n = file.replace(/\.\w+$/, '');
  return kind === 'house'
    ? { id: `house_${n}`, name: `Будинок #${n}`, section: 'realty', cat: 'Будинки', photo: u, num: +n }
    : { id: `biz_${n}`, name: `Бізнес #${n}`, section: 'business', cat: 'Бізнеси', photo: u, num: +n };
}).sort((a, b) => a.section.localeCompare(b.section) || a.num - b.num);

cat.generated = ex.generated;
fs.writeFileSync('src/data/catalog.json', JSON.stringify(cat, null, 1));
console.log({ addI, updI, items: cat.items.length, addV, updV, vehicles: cat.vehicles.length, clothes: cat.clothes.length, properties: cat.properties.length });
