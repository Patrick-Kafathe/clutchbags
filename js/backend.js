/* Clutch Bags Kenya — in-browser "server".
   Answers the same /api/... calls the old Node server did, but keeps everything in this
   browser's localStorage, so the site works by simply opening index.html (no PHP, no Node).
   Note: data lives in the browser it was entered in. Use Admin → Settings → Backup to move it. */
(function () {
  'use strict';
  const KEY = 'cbk_db_v1';
  const SALT = 'cbk-local';

  /* ---------------------------------------------------------------- storage */
  let mem = null; // fallback if the browser blocks localStorage
  const rawGet = () => { try { return localStorage.getItem(KEY); } catch (e) { return mem; } };
  const rawSet = (v) => {
    try { localStorage.setItem(KEY, v); mem = v; }
    catch (e) {
      if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)))) throw new Error('Browser storage is full. Delete some photos or upload smaller ones.');
      mem = v; // storage blocked entirely: keep for this session only
    }
  };

  function cyrb53(str, seed) {
    let h1 = 0xdeadbeef ^ (seed || 0), h2 = 0x41c6ce57 ^ (seed || 0);
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  const hashPw = (pw) => cyrb53(SALT + pw) + cyrb53(pw + SALT, 7);

  function freshDb() {
    const d = JSON.parse(JSON.stringify(window.CBK_SEED || { settings: {}, categories: [], banners: [], products: [], seq: {} }));
    d.orders = d.orders || []; d.messages = d.messages || [];
    d.seq = Object.assign({ product: d.products.length, category: d.categories.length, banner: d.banners.length, order: 1000, message: 0 }, d.seq);
    d.admin = { hash: hashPw('admin123'), defaultPw: true };
    return d;
  }
  function load() {
    const raw = rawGet();
    if (raw) { try { const d = JSON.parse(raw); if (d && Array.isArray(d.products)) return d; } catch (e) { /* fall through */ } }
    const d = freshDb(); try { rawSet(JSON.stringify(d)); } catch (e) { /* ignore */ } return d;
  }
  let db = load();
  const SEED_V = (window.CBK_SEED && window.CBK_SEED.version) || 1;
  if ((db.version || 1) < SEED_V) { // newer sample catalogue: refresh it, keep orders, messages, password, settings and your own products
    const f = freshDb(); const oldSeed = 60;
    const mine = (db.products || []).filter((p) => p.id > oldSeed && !p.seed); let nid = f.seq.product;
    mine.forEach((p) => { p.id = ++nid; }); f.seq.product = nid; f.products = f.products.concat(mine);
    const extraCats = (db.categories || []).filter((c) => c.id > 8); f.categories = f.categories.concat(extraCats); f.seq.category = Math.max(f.seq.category, (db.seq || {}).category || 0);
    f.orders = db.orders || []; f.messages = db.messages || []; f.admin = db.admin || f.admin; f.settings = Object.assign({}, f.settings, db.settings);
    f.seq.order = Math.max(f.seq.order, (db.seq || {}).order || 0); f.seq.message = Math.max(f.seq.message || 0, (db.seq || {}).message || 0);
    db = f; try { rawSet(JSON.stringify(db)); } catch (e) { /* keep in memory */ }
  }
  db.messages = db.messages || []; db.seq.message = db.seq.message || 0;
  db.settings = Object.assign({ twitter: 'clutch_bags_ke', couponCode: 'WELCOME10', couponPercent: '10', saleTitle: 'Black Friday Deals', saleEnds: '2026-11-30T23:59' }, db.settings);

  function save() {
    const before = rawGet();
    try { rawSet(JSON.stringify(db)); }
    catch (e) { if (before) { try { db = JSON.parse(before); } catch (x) { /* keep */ } } throw e; } // roll back on failure
  }

  /* ---------------------------------------------------------------- helpers */
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 500);
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); };
  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const okImg = (x) => /^(img\/|data:image\/(png|jpeg|webp|gif);base64,)/.test(x);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const publicStore = () => clone({
    settings: (({ storeName, tagline, topBar, phone, whatsapp, email, address, hours, twitter, instagram, facebook, mpesaType, mpesaNumber, mpesaName, deliveryZones, freeDeliveryNote, couponCode, couponPercent, saleTitle, saleEnds }) =>
      ({ storeName, tagline, topBar, phone, whatsapp, email, address, hours, twitter, instagram, facebook, mpesaType, mpesaNumber, mpesaName, deliveryZones, freeDeliveryNote, couponCode, couponPercent, saleTitle, saleEnds }))(db.settings),
    categories: [...db.categories].sort((a, b) => a.order - b.order),
    banners: db.banners.filter((b) => b.active).sort((a, b) => a.order - b.order),
    products: db.products.filter((p) => p.visible).sort((a, b) => (b.featured - a.featured) || (b.createdAt - a.createdAt)),
  });
  const parseZones = () => String(db.settings.deliveryZones || '').split('\n').map((l) => l.split('|')).filter((p) => p[0] && p[0].trim()).map((p) => ({ name: p[0].trim(), fee: num(p[1], 0) }));

  function cleanSpecs(v) {
    const lines = Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? x[0] + ': ' + x[1] : String(x))) : String(v || '').split('\n');
    return lines.map((l) => { const i = l.indexOf(':'); return i > 0 ? [str(l.slice(0, i), 40), str(l.slice(i + 1), 200)] : null; }).filter((x) => x && x[0] && x[1]).slice(0, 14);
  }
  function cleanProduct(b) {
    const cat = db.categories.find((c) => c.id === num(b.categoryId));
    if (!str(b.name)) throw new Error('Product name is required');
    if (!cat) throw new Error('Choose a category');
    if (num(b.price) <= 0) throw new Error('Enter a valid price');
    const images = (Array.isArray(b.images) ? b.images : []).map((x) => String(x || '')).filter(okImg).slice(0, 10);
    const colors = (Array.isArray(b.colors) ? b.colors : String(b.colors || '').split(',')).map((x) => str(x, 40)).filter(Boolean).slice(0, 12);
    return { name: str(b.name, 140), slug: slugify(str(b.name, 140)), categoryId: cat.id, price: Math.round(num(b.price)), oldPrice: Math.round(num(b.oldPrice)), stock: Math.max(0, Math.round(num(b.stock))), colors, images, badge: str(b.badge, 20), description: str(b.description, 4000), specs: cleanSpecs(b.specs), visible: !!b.visible, featured: !!b.featured };
  }
  function cleanBanner(b) {
    if (!str(b.title)) throw new Error('Banner title is required');
    const img = String(b.image || '');
    return { tag: str(b.tag, 40), title: str(b.title, 120), subtitle: str(b.subtitle, 240), buttonText: str(b.buttonText, 40) || 'Shop now', link: str(b.link, 200) || '#/shop', image: okImg(img) ? img : '', bg: /^#[0-9a-f]{3,8}$/i.test(str(b.bg)) ? str(b.bg) : '#e4f1ea', active: !!b.active };
  }

  /* shrink big uploads so they fit in browser storage */
  function shrink(data, type) {
    return new Promise((res, rej) => {
      const im = new Image(); im.onerror = () => rej(new Error('Could not read that image.'));
      im.onload = () => {
        const k = Math.min(1, 1100 / Math.max(im.width, im.height)); const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        const x = c.getContext('2d'); if (type === 'jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
        x.drawImage(im, 0, 0, c.width, c.height);
        let out = c.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/webp', 0.82);
        if (type !== 'jpeg' && !out.startsWith('data:image/webp')) out = c.toDataURL('image/png');
        res(out);
      };
      im.src = data;
    });
  }

  /* -------------------------------------------------------------------- API */
  const ok = (o) => [200, o];
  const fail = (code, msg) => [code, { error: msg }];
  const bad = (m) => fail(400, m);

  async function handle(method, path, b, auth) {
    // ---- public
    if (path === '/api/store' && method === 'GET') return ok(publicStore());

    if (path === '/api/orders' && method === 'POST') {
      const name = str(b.name, 100), phone = str(b.phone, 20).replace(/[^\d+]/g, '');
      if (!name) return bad('Please enter your full name.');
      if (phone.replace(/\D/g, '').length < 9) return bad('Please enter a valid phone number.');
      const zone = parseZones().find((z) => z.name === b.zone);
      if (!zone) return bad('Please choose a delivery area.');
      const items = [];
      for (const it of Array.isArray(b.items) ? b.items.slice(0, 50) : []) {
        const pr = db.products.find((x) => x.id === num(it.id) && x.visible); if (!pr) continue;
        const qty = Math.max(1, Math.min(20, Math.round(num(it.qty, 1))));
        if (pr.stock < qty) return bad(`Sorry, only ${pr.stock} of "${pr.name}" left in stock.`);
        items.push({ id: pr.id, name: pr.name, color: str(it.color, 40), qty, price: pr.price, image: pr.images[0] || '' });
      }
      if (!items.length) return bad('Your cart is empty.');
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      let discount = 0, coupon = '';
      if (str(b.coupon)) {
        const cc = String(db.settings.couponCode || '').trim().toUpperCase();
        if (!cc || str(b.coupon).toUpperCase() !== cc) return bad('That promo code is not valid.');
        discount = Math.round(subtotal * num(db.settings.couponPercent) / 100); coupon = cc;
      }
      items.forEach((i) => { db.products.find((x) => x.id === i.id).stock -= i.qty; });
      db.seq.order++;
      const order = { id: db.seq.order, number: `CBK-${db.seq.order}`, createdAt: Date.now(), status: 'pending', payment: b.payment === 'cod' ? 'cod' : 'mpesa', paid: false,
        customer: { name, phone, town: str(b.town, 80), address: str(b.address, 300), notes: str(b.notes, 500) }, zone: zone.name, delivery: zone.fee, subtotal, discount, coupon, total: subtotal - discount + zone.fee, items };
      db.orders.unshift(order); save();
      return ok({ id: order.id, number: order.number, total: order.total });
    }

    if (path === '/api/track' && method === 'POST') {
      const num9 = (x) => String(x || '').replace(/\D/g, '').slice(-9);
      const o = db.orders.find((x) => x.number.toUpperCase() === str(b.number, 30).toUpperCase().replace(/^#/, '') && num9(x.customer.phone) === num9(b.phone));
      if (!o) return fail(404, 'We could not find an order with those details. Check the order number and phone.');
      return ok(clone({ number: o.number, status: o.status, paid: o.paid, createdAt: o.createdAt, total: o.total, zone: o.zone, items: o.items.map((i) => ({ name: i.name, qty: i.qty, image: i.image })) }));
    }

    if (path === '/api/messages' && method === 'POST') {
      if (!str(b.name) || !str(b.message)) return bad('Please enter your name and message.');
      db.seq.message++;
      db.messages.unshift({ id: db.seq.message, createdAt: Date.now(), name: str(b.name, 100), phone: str(b.phone, 30), email: str(b.email, 120), message: str(b.message, 2000), read: false });
      db.messages = db.messages.slice(0, 500); save(); return ok({ ok: true });
    }

    // ---- admin login
    if (path === '/api/admin/login' && method === 'POST') {
      if (hashPw(String(b.password || '')) !== db.admin.hash) return fail(401, 'Wrong password.');
      return ok({ token: 'cbk.' + (Date.now() + 12 * 3600 * 1000), defaultPw: !!db.admin.defaultPw });
    }

    if (!path.startsWith('/api/admin/')) return fail(404, 'Not found');
    const tk = String(auth || '').replace(/^Bearer /, '');
    if (!/^cbk\.\d+$/.test(tk) || Number(tk.slice(4)) < Date.now()) return fail(401, 'Session expired. Please sign in again.');

    if (path === '/api/admin/overview' && method === 'GET') {
      const revenue = db.orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
      return ok(clone({ defaultPw: !!db.admin.defaultPw, products: db.products.length, live: db.products.filter((x) => x.visible).length, categories: db.categories.length, banners: db.banners.filter((x) => x.active).length, orders: db.orders.length, revenue, unreadMessages: db.messages.filter((x) => !x.read).length, recentOrders: db.orders.slice(0, 6),
        lowStock: db.products.filter((x) => x.stock <= 5).sort((a, c) => a.stock - c.stock).slice(0, 6).map((x) => ({ id: x.id, name: x.name, stock: x.stock, image: x.images[0] || '' })) }));
    }

    // products
    if (path === '/api/admin/products' && method === 'GET') return ok(clone([...db.products].sort((a, c) => c.id - a.id)));
    if (path === '/api/admin/products' && method === 'POST') { const p = cleanProduct(b); p.id = ++db.seq.product; p.createdAt = Date.now(); db.products.unshift(p); save(); return ok(p); }
    let mt = path.match(/^\/api\/admin\/products\/(\d+)$/);
    if (mt) {
      const i = db.products.findIndex((x) => x.id === +mt[1]); if (i < 0) return fail(404, 'Product not found');
      if (method === 'PUT') { db.products[i] = Object.assign({}, db.products[i], cleanProduct(b)); save(); return ok(db.products[i]); }
      if (method === 'PATCH') { if ('visible' in b) db.products[i].visible = !!b.visible; save(); return ok(db.products[i]); }
      if (method === 'DELETE') { db.products.splice(i, 1); save(); return ok({ ok: true }); }
    }

    // categories
    if (path === '/api/admin/categories' && method === 'GET') return ok(db.categories.map((c) => Object.assign({}, c, { count: db.products.filter((x) => x.categoryId === c.id).length })).sort((a, c) => a.order - c.order));
    if (path === '/api/admin/categories' && method === 'POST') {
      if (!str(b.name)) return bad('Category name is required');
      const c = { id: ++db.seq.category, name: str(b.name, 60), slug: slugify(str(b.name, 60)) + '-' + db.seq.category, icon: str(b.icon, 20) || 'bag', order: db.categories.length + 1 };
      db.categories.push(c); save(); return ok(c);
    }
    mt = path.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (mt) {
      const i = db.categories.findIndex((x) => x.id === +mt[1]); if (i < 0) return fail(404, 'Category not found');
      if (method === 'PUT') { if (!str(b.name)) return bad('Category name is required'); db.categories[i].name = str(b.name, 60); db.categories[i].icon = str(b.icon, 20) || db.categories[i].icon; if ('order' in b) db.categories[i].order = num(b.order, db.categories[i].order); save(); return ok(db.categories[i]); }
      if (method === 'DELETE') { if (db.products.some((x) => x.categoryId === db.categories[i].id)) return bad('Move or delete the products in this category first.'); db.categories.splice(i, 1); save(); return ok({ ok: true }); }
    }

    // banners
    if (path === '/api/admin/banners' && method === 'GET') return ok(clone([...db.banners].sort((a, c) => a.order - c.order)));
    if (path === '/api/admin/banners' && method === 'POST') { const x = cleanBanner(b); x.id = ++db.seq.banner; x.order = db.banners.length + 1; db.banners.push(x); save(); return ok(x); }
    if (path === '/api/admin/banners/reorder' && method === 'POST') { (Array.isArray(b.ids) ? b.ids : []).forEach((id, idx) => { const x = db.banners.find((y) => y.id === +id); if (x) x.order = idx + 1; }); save(); return ok({ ok: true }); }
    mt = path.match(/^\/api\/admin\/banners\/(\d+)$/);
    if (mt) {
      const i = db.banners.findIndex((x) => x.id === +mt[1]); if (i < 0) return fail(404, 'Banner not found');
      if (method === 'PUT') { db.banners[i] = Object.assign({}, db.banners[i], cleanBanner(b)); save(); return ok(db.banners[i]); }
      if (method === 'PATCH') { db.banners[i].active = !!b.active; save(); return ok(db.banners[i]); }
      if (method === 'DELETE') { db.banners.splice(i, 1); save(); return ok({ ok: true }); }
    }

    // orders & messages
    if (path === '/api/admin/orders' && method === 'GET') return ok(clone(db.orders));
    mt = path.match(/^\/api\/admin\/orders\/(\d+)$/);
    if (mt && method === 'PATCH') {
      const o = db.orders.find((x) => x.id === +mt[1]); if (!o) return fail(404, 'Order not found');
      if (['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'].includes(b.status)) {
        if (b.status === 'cancelled' && o.status !== 'cancelled') o.items.forEach((i) => { const pr = db.products.find((x) => x.id === i.id); if (pr) pr.stock += i.qty; });
        o.status = b.status;
      }
      if ('paid' in b) o.paid = !!b.paid;
      save(); return ok(o);
    }
    if (path === '/api/admin/messages' && method === 'GET') return ok(clone(db.messages));
    mt = path.match(/^\/api\/admin\/messages\/(\d+)$/);
    if (mt) {
      const i = db.messages.findIndex((x) => x.id === +mt[1]); if (i < 0) return fail(404, 'Not found');
      if (method === 'PATCH') { db.messages[i].read = true; save(); return ok(db.messages[i]); }
      if (method === 'DELETE') { db.messages.splice(i, 1); save(); return ok({ ok: true }); }
    }

    // settings & password
    if (path === '/api/admin/settings' && method === 'GET') return ok(clone(db.settings));
    if (path === '/api/admin/settings' && method === 'PUT') {
      for (const k of Object.keys(db.settings)) if (k in b) db.settings[k] = str(b[k], k === 'deliveryZones' ? 1500 : 300);
      db.settings.whatsapp = String(db.settings.whatsapp || '').replace(/\D/g, ''); save(); return ok(db.settings);
    }
    if (path === '/api/admin/password' && method === 'POST') {
      if (hashPw(String(b.current || '')) !== db.admin.hash) return bad('Current password is wrong.');
      if (str(b.next, 100).length < 8) return bad('New password must be at least 8 characters.');
      db.admin = { hash: hashPw(String(b.next)), defaultPw: false }; save(); return ok({ ok: true });
    }

    // image upload → stored inline (data URL)
    if (path === '/api/admin/upload' && method === 'POST') {
      const data = String(b.data || ''); const m = data.match(/^data:image\/(png|jpeg|webp|gif);base64,/);
      if (!m) return bad('Unsupported image. Use JPG, PNG or WEBP.');
      if (data.length > 12e6) return bad('Image is too large (max 8MB).');
      return ok({ url: data.length < 180000 ? data : await shrink(data, m[1]) });
    }

    // backup / restore / reset
    if (path === '/api/admin/backup' && method === 'GET') return ok(clone(db));
    if (path === '/api/admin/restore' && method === 'POST') {
      const d = b.db; if (!d || !Array.isArray(d.products) || !Array.isArray(d.categories) || !Array.isArray(d.banners) || !d.settings || !d.admin || !d.seq) return bad('That file is not a valid Clutch Bags Kenya backup.');
      const prev = db; db = d; try { save(); } catch (e) { db = prev; throw e; } return ok({ ok: true });
    }
    if (path === '/api/admin/reset' && method === 'POST') { db = freshDb(); save(); return ok({ ok: true }); }

    return fail(404, 'Not found');
  }

  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!/^\/api\//.test(url)) return realFetch ? realFetch(input, init) : Promise.reject(new Error('Network unavailable'));
    init = init || {};
    let body = {}; try { body = init.body ? JSON.parse(init.body) : {}; } catch (e) { /* empty */ }
    const h = init.headers || {};
    let r;
    try { r = await handle((init.method || 'GET').toUpperCase(), url.split('?')[0], body, h.Authorization || h.authorization); }
    catch (e) { r = [400, { error: e.message || 'Request failed' }]; }
    return new Response(JSON.stringify(r[1]), { status: r[0], headers: { 'Content-Type': 'application/json' } });
  };
})();
