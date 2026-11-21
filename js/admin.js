/* Clutch Bags Kenya — admin panel */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => 'KSh ' + Math.round(n).toLocaleString('en-KE');
  const when = (t) => new Date(t).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const hv = () => location.hash.replace(/^#\/admin\/?/, '');
  let token = sessionStorage.getItem('cbk_admin') || '';
  let cats = [], view = 'dashboard', defaultPw = false;

  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }

  async function api(path, method, body) {
    const r = await fetch('/api/admin/' + path, { method: method || 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
    let d = {}; try { d = await r.json(); } catch (e) { /* empty */ }
    if (r.status === 401) { logout(true); throw new Error(d.error || 'Signed out'); }
    if (!r.ok) throw new Error(d.error || 'Something went wrong');
    return d;
  }
  function logout(expired) { token = ''; sessionStorage.removeItem('cbk_admin'); loginScreen(expired ? 'Session expired. Please sign in again.' : ''); }

  /* --------------------------------------------------------------- login */
  function loginScreen(msg) {
    $('#root').innerHTML = `<div class="login"><form class="box" id="lf"><img src="img/logo.png" alt="Clutch Bags Kenya"><h1>Admin sign in</h1><p>Manage products, banners and orders</p>
      ${msg ? `<div class="err">${esc(msg)}</div>` : ''}<div class="fld"><label class="l">Password</label><input type="password" id="pw" autofocus autocomplete="current-password"></div>
      <button class="btn" style="width:100%;justify-content:center" id="lb">Sign in</button><p style="margin:16px 0 0"><a href="index.html" style="color:var(--g700);font-weight:600">← Back to store</a></p></form></div>`;
    $('#lf').addEventListener('submit', async (e) => {
      e.preventDefault(); const b = $('#lb'); b.disabled = true;
      try { const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); token = d.token; sessionStorage.setItem('cbk_admin', token); defaultPw = d.defaultPw; start(); }
      catch (ex) { loginScreen(ex.message); }
    });
  }

  /* --------------------------------------------------------------- shell */
  const NAV = [['dashboard', 'chart', 'Dashboard'], ['products', 'box', 'Products'], ['banners', 'image', 'Slide banners'], ['categories', 'tag', 'Categories'], ['orders', 'cart', 'Orders'], ['messages', 'mail', 'Messages'], ['settings', 'settings', 'Settings']];
  async function start() {
    $('#root').innerHTML = `<div class="layout"><aside class="side" id="side"><div class="brand"><img src="img/logo.png" alt=""><b>Clutch Bags<br>Kenya</b></div><nav class="nav" id="nav"></nav>
      <div class="bottom"><a href="index.html" target="_blank">${icon('external', 20)} View store</a><button id="out">${icon('logout', 20)} Sign out</button></div></aside><main class="main" id="view"></main></div>`;
    $('#out').addEventListener('click', () => logout());
    try { cats = await api('categories'); } catch (e) { return; }
    go(hv() || 'dashboard');
  }
  async function renderNav() {
    let unread = 0; try { unread = (await api('messages')).filter((m) => !m.read).length; } catch (e) { /* ignore */ }
    $('#nav').innerHTML = NAV.map((n) => `<a href="#/admin/${n[0]}" class="${view === n[0] ? 'on' : ''}">${icon(n[1], 20)} ${n[2]}${n[0] === 'messages' && unread ? `<span class="dot">${unread}</span>` : ''}</a>`).join('');
    $('#side').classList.remove('open');
  }
  window.addEventListener('hashchange', () => { if (token) go(hv() || 'dashboard'); });
  function go(v) {
    view = NAV.some((n) => n[0] === v) ? v : 'dashboard'; renderNav();
    const fn = { dashboard: vDash, products: vProducts, banners: vBanners, categories: vCats, orders: vOrders, messages: vMsgs, settings: vSettings }[view];
    $('#view').innerHTML = '<div class="center muted">Loading…</div>'; fn().catch((e) => { $('#view').innerHTML = `<div class="err">${esc(e.message)}</div>`; });
  }
  const head = (title, extra) => `<div class="top"><div style="display:flex;gap:12px;align-items:center"><button class="menubtn" id="mb" aria-label="Menu">${icon('menu', 20)}</button><h1>${title}</h1></div>${extra || ''}</div>`;
  function bindMenu() { const b = $('#mb'); b && b.addEventListener('click', () => $('#side').classList.toggle('open')); }
  const addBtn = (id, label) => `<button class="btn" id="${id}">${icon('plus', 18)} ${label}</button>`;

  /* ------------------------------------------------------------- modal */
  function modal(title, body, onSave, opts) {
    opts = opts || {};
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${opts.sm ? 'sm' : ''}" role="dialog" aria-modal="true"><header><h2>${title}</h2><button class="iconbtn" data-x aria-label="Close">${icon('x', 18)}</button></header><div class="body">${body}</div>${onSave ? `<footer><button class="btn ghost" data-x>Cancel</button><button class="btn" data-save>${opts.saveLabel || 'Save'}</button></footer>` : ''}</div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) bg._down = true; }); bg.addEventListener('mouseup', (e) => { if (e.target === bg && bg._down) close(); bg._down = false; });
    $$('[data-x]', bg).forEach((b) => b.addEventListener('click', close));
    const sv = $('[data-save]', bg);
    if (sv) sv.addEventListener('click', async () => { sv.disabled = true; const er = $('.err', bg); er && er.remove(); try { await onSave(bg); close(); } catch (e) { sv.disabled = false; $('.body', bg).insertAdjacentHTML('afterbegin', `<div class="err">${esc(e.message)}</div>`); $('.body', bg).scrollTop = 0; } });
    return { el: bg, close };
  }
  const confirmBox = (msg, onYes) => modal('Please confirm', `<p>${msg}</p>`, async () => { await onYes(); }, { sm: true, saveLabel: 'Yes, delete' });

  /* -------------------------------------------------------- image upload */
  function fileToDataUrl(file, max) {
    return new Promise((res, rej) => {
      const fr = new FileReader(); fr.onerror = () => rej(new Error('Could not read image'));
      fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('Unsupported image')); im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.8)); }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  async function uploadFiles(files, max) { const out = []; for (const f of files) { const data = await fileToDataUrl(f, max || 1000); const r = await api('upload', 'POST', { data }); out.push(r.url); } return out; }

  /* ------------------------------------------------------------ dashboard */
  async function vDash() {
    const o = await api('overview'); defaultPw = o.defaultPw;
    const st = [['box', o.products, `Products (${o.live} live)`], ['tag', o.categories, 'Categories'], ['image', o.banners, 'Active banners'], ['cart', o.orders, `Orders · ${money(o.revenue)}`]];
    $('#view').innerHTML = head('Dashboard', addBtn('addp', 'Add product')) +
      (o.defaultPw ? `<div class="warn"><b>Security:</b> you are still using the default admin password. Please change it in <a href="#/admin/settings">Settings</a>.</div>` : '') +
      `<div class="stats">${st.map((s) => `<div class="stat"><div class="ico">${icon(s[0], 24)}</div><div><b>${s[1]}</b><span>${s[2]}</span></div></div>`).join('')}</div>
      <div class="two"><div class="card" style="min-height:300px"><h3>Recent orders</h3>${o.recentOrders.length ? o.recentOrders.map((r) => `<div class="row"><div class="grow"><b>${esc(r.number)}</b> · ${esc(r.customer.name)}<div class="muted">${when(r.createdAt)} · ${r.items.length} item(s)</div></div><div style="text-align:right"><b>${money(r.total)}</b><div>${statusPill(r.status)}</div></div></div>`).join('') : '<div class="center muted">No orders yet</div>'}</div>
      <div class="card"><h3>Low stock</h3>${o.lowStock.length ? o.lowStock.map((p) => `<div class="row"><img src="${esc(p.image)}" alt=""><div class="grow"><b>${esc(p.name)}</b></div><span class="pill ${p.stock < 1 ? 'red' : 'amber'}">${p.stock < 1 ? 'Sold out' : p.stock + ' left'}</span></div>`).join('') : '<div class="center muted">All products well stocked</div>'}</div></div>`;
    bindMenu(); $('#addp').addEventListener('click', () => productModal());
  }
  const statusPill = (s) => `<span class="pill ${{ pending: 'amber', confirmed: 'blue', dispatched: 'blue', delivered: '', cancelled: 'red' }[s] || ''}">${s}</span>`;

  /* -------------------------------------------------------------- products */
  let PRODS = [];
  async function vProducts() {
    PRODS = await api('products'); cats = await api('categories');
    $('#view').innerHTML = head('Products', addBtn('addp', 'Add product')) + `<div class="tools"><input id="ps" placeholder="Search products…"><select id="pc"><option value="">All categories</option>${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div id="plist"></div>`;
    bindMenu(); $('#addp').addEventListener('click', () => productModal());
    const draw = () => {
      const q = $('#ps').value.toLowerCase(); const c = $('#pc').value;
      const list = PRODS.filter((p) => (!c || p.categoryId === +c) && (!q || p.name.toLowerCase().includes(q)));
      $('#plist').innerHTML = list.length ? `<div class="tbl-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Live</th><th style="text-align:right">Actions</th></tr></thead><tbody>${list.map((p) => `<tr><td><div class="pcell"><img src="${esc(p.images[0] || 'img/logo.png')}" alt=""><div><b>${esc(p.name)}</b><small>${esc((cats.find((x) => x.id === p.categoryId) || {}).name || '')}${p.badge ? ' · ' + esc(p.badge) : ''}</small></div></div></td>
        <td>${money(p.price)}${p.oldPrice > p.price ? `<small class="muted" style="display:block"><s>${money(p.oldPrice)}</s></small>` : ''}</td><td><span class="pill ${p.stock < 1 ? 'red' : p.stock <= 5 ? 'amber' : 'grey'}">${p.stock}</span></td>
        <td><label class="sw"><input type="checkbox" data-live="${p.id}" ${p.visible ? 'checked' : ''}><span></span></label></td>
        <td style="text-align:right;white-space:nowrap"><button class="iconbtn" data-edit="${p.id}" aria-label="Edit">${icon('edit', 16)}</button><button class="iconbtn red" data-del="${p.id}" aria-label="Delete">${icon('trash', 16)}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card center muted">No products found.</div>';
    };
    draw(); $('#ps').addEventListener('input', draw); $('#pc').addEventListener('change', draw);
    $('#plist').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edit]'), de = e.target.closest('[data-del]');
      if (ed) productModal(PRODS.find((p) => p.id === +ed.dataset.edit));
      if (de) { const p = PRODS.find((x) => x.id === +de.dataset.del); confirmBox(`Delete <b>${esc(p.name)}</b>? This cannot be undone.`, async () => { await api('products/' + p.id, 'DELETE'); toast('Product deleted'); vProducts(); }); }
    });
    $('#plist').addEventListener('change', async (e) => { const t = e.target.closest('[data-live]'); if (t) { try { await api('products/' + t.dataset.live, 'PATCH', { visible: t.checked }); const p = PRODS.find((x) => x.id === +t.dataset.live); p.visible = t.checked; toast(t.checked ? 'Product is live' : 'Product hidden'); } catch (ex) { toast(ex.message); t.checked = !t.checked; } } });
  }

  function productModal(p) {
    const isNew = !p; p = p || { name: '', categoryId: cats[0] ? cats[0].id : '', badge: '', price: '', oldPrice: '', stock: 10, colors: [], images: [], specs: [], description: '', visible: true, featured: false };
    let images = [...p.images];
    const body = `<div class="fld"><label class="l">Product name *</label><input id="f_name" value="${esc(p.name)}"></div>
      <div class="f2"><div class="fld"><label class="l">Category *</label><select id="f_cat">${cats.map((c) => `<option value="${c.id}" ${c.id === p.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="fld"><label class="l">Badge (optional)</label><select id="f_badge">${['', 'NEW', 'HOT', 'BEST SELLER', 'SALE'].map((b) => `<option value="${b}" ${p.badge === b ? 'selected' : ''}>${b || 'None'}</option>`).join('')}</select></div>
      <div class="fld"><label class="l">Price (KSh) *</label><input id="f_price" type="number" min="1" value="${esc(p.price)}"></div>
      <div class="fld"><label class="l">Old price (KSh)</label><input id="f_old" type="number" min="0" value="${p.oldPrice || ''}"><div class="hint">Fill in higher than price to show a discount.</div></div>
      <div class="fld"><label class="l">Stock quantity</label><input id="f_stock" type="number" min="0" value="${esc(p.stock)}"></div>
      <div class="fld"><label class="l">Colours</label><input id="f_cols" value="${esc(p.colors.join(', '))}" placeholder="Black, Gold"><div class="hint">Separate with commas.</div></div></div>
      <div class="fld"><label class="l">Photos <span class="muted" style="font-weight:400">— first photo is the main one; all photos slide automatically on the store</span></label><div class="photos" id="photos"></div><input type="file" id="f_file" accept="image/*" multiple hidden></div>
      <div class="fld"><label class="l">Description</label><textarea id="f_desc">${esc(p.description)}</textarea></div>
      <div class="fld"><label class="l">Specifications</label><textarea id="f_specs" style="min-height:120px" placeholder="Material: PU leather&#10;Size (L × H × W): 23 × 13 × 5 cm&#10;Closure: Gold clasp">${esc((p.specs || []).map((r) => r[0] + ': ' + r[1]).join('\n'))}</textarea><div class="hint">One per line as <b>Label: value</b>. Shown as icons and a table on the product page (Material, Size, Closure, Strap, Fits, Best for, Care).</div></div>
      <div class="togs"><label><span class="sw"><input type="checkbox" id="f_vis" ${p.visible ? 'checked' : ''}><span></span></span> Visible on store</label><label><span class="sw"><input type="checkbox" id="f_feat" ${p.featured ? 'checked' : ''}><span></span></span> Featured first</label></div>`;
    const m = modal(isNew ? 'Add product' : 'Edit product', body, async () => {
      const payload = { name: $('#f_name').value, categoryId: +$('#f_cat').value, badge: $('#f_badge').value, price: $('#f_price').value, oldPrice: $('#f_old').value, stock: $('#f_stock').value, colors: $('#f_cols').value, images, description: $('#f_desc').value, specs: $('#f_specs').value.split('\n').map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null; }).filter((r) => r && r[0] && r[1]), visible: $('#f_vis').checked, featured: $('#f_feat').checked };
      if (isNew) await api('products', 'POST', payload); else await api('products/' + p.id, 'PUT', payload);
      toast(isNew ? 'Product added' : 'Product saved'); if (view === 'products') vProducts(); else go(view);
    });
    const drawPhotos = () => {
      $('#photos', m.el).innerHTML = images.map((u, i) => `<div class="ph"><div class="im"><img src="${esc(u)}" alt="">${i === 0 ? '<span class="main">MAIN</span>' : ''}</div><div class="ctl"><button data-m="${i}:-1" aria-label="Move left">${icon('left', 14)}</button><button data-m="${i}:1" aria-label="Move right">${icon('right', 14)}</button><button data-r="${i}" aria-label="Remove">${icon('trash', 14)}</button></div></div>`).join('') + `<div class="up" id="upbtn">${icon('upload', 22)}<div style="margin-top:6px">Upload<br>photos</div></div>`;
    };
    drawPhotos();
    m.el.addEventListener('click', async (e) => {
      const mv = e.target.closest('[data-m]'), rm = e.target.closest('[data-r]');
      if (mv) { const [i, d] = mv.dataset.m.split(':').map(Number); const j = i + d; if (j >= 0 && j < images.length) { [images[i], images[j]] = [images[j], images[i]]; drawPhotos(); } }
      if (rm) { images.splice(+rm.dataset.r, 1); drawPhotos(); }
      if (e.target.closest('#upbtn')) $('#f_file', m.el).click();
    });
    $('#f_file', m.el).addEventListener('change', async (e) => {
      const files = Array.from(e.target.files); if (!files.length) return; const up = $('#upbtn', m.el); up.innerHTML = '<div>Uploading…</div>';
      try { images.push(...(await uploadFiles(files, 1200))); } catch (ex) { toast(ex.message); } drawPhotos(); e.target.value = '';
    });
  }

  /* --------------------------------------------------------------- banners */
  async function vBanners() {
    const list = await api('banners'); cats = await api('categories');
    $('#view').innerHTML = head('Slide banners', addBtn('addb', 'Add banner')) + `<p class="muted" style="margin:-8px 0 16px">These slides appear at the top of the home page and change automatically every 6 seconds.</p>` +
      (list.length ? list.map((b, i) => `<div class="banner"><div class="pv" style="background:${esc(b.bg)}">${b.image ? `<img src="${esc(b.image)}" alt="">` : '<span class="muted">No image</span>'}</div>
        <div><span class="pill ${b.active ? '' : 'grey'}">${b.active ? 'Live' : 'Hidden'}</span><h4>${esc(b.title)}</h4><p>${esc(b.subtitle)}</p><p style="margin-top:4px">Button: <b>${esc(b.buttonText)}</b> → ${esc(b.link)}</p></div>
        <div class="act"><label class="sw" title="Live"><input type="checkbox" data-bl="${b.id}" ${b.active ? 'checked' : ''}><span></span></label>
        <button class="iconbtn" data-bu="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up', 16)}</button><button class="iconbtn" data-bd="${i}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down', 16)}</button>
        <button class="iconbtn" data-be="${b.id}" aria-label="Edit">${icon('edit', 16)}</button><button class="iconbtn red" data-bx="${b.id}" aria-label="Delete">${icon('trash', 16)}</button></div></div>`).join('') : '<div class="card center muted">No banners yet. Add your first slide.</div>');
    bindMenu(); $('#addb').addEventListener('click', () => bannerModal());
    const v = $('#view');
    v.onclick = async (e) => {
      const t = (a) => e.target.closest(`[${a}]`);
      const be = t('data-be'), bx = t('data-bx'), bu = t('data-bu'), bd = t('data-bd');
      if (be) bannerModal(list.find((x) => x.id === +be.dataset.be));
      if (bx) confirmBox('Delete this banner?', async () => { await api('banners/' + bx.dataset.bx, 'DELETE'); toast('Banner deleted'); vBanners(); });
      const sw = (bu || bd) && +(bu || bd).dataset[bu ? 'bu' : 'bd'];
      if (bu || bd) { const j = bu ? sw - 1 : sw + 1; const ids = list.map((x) => x.id); [ids[sw], ids[j]] = [ids[j], ids[sw]]; await api('banners/reorder', 'POST', { ids }); vBanners(); }
    };
    v.onchange = async (e) => { const t = e.target.closest('[data-bl]'); if (t) { await api('banners/' + t.dataset.bl, 'PATCH', { active: t.checked }); toast(t.checked ? 'Banner is live' : 'Banner hidden'); vBanners(); } };
  }
  function bannerModal(b) {
    const isNew = !b; b = b || { tag: '', title: '', subtitle: '', buttonText: 'Shop now', link: '#/shop', image: '', bg: '#e4f1ea', active: true };
    let image = b.image;
    const links = [['#/shop', 'All clutches'], ...cats.map((c) => ['#/shop?cat=' + c.slug, c.name])];
    const body = `<div class="f2"><div class="fld"><label class="l">Small label (optional)</label><input id="b_tag" value="${esc(b.tag)}" placeholder="NEW SEASON"></div><div class="fld"><label class="l">Background colour</label><input id="b_bg" type="color" value="${/^#[0-9a-f]{6}$/i.test(b.bg) ? b.bg : '#e4f1ea'}" style="height:46px;padding:4px"></div></div>
      <div class="fld"><label class="l">Headline *</label><input id="b_title" value="${esc(b.title)}"></div><div class="fld"><label class="l">Sub-text</label><textarea id="b_sub" style="min-height:70px">${esc(b.subtitle)}</textarea></div>
      <div class="f2"><div class="fld"><label class="l">Button text</label><input id="b_btn" value="${esc(b.buttonText)}"></div><div class="fld"><label class="l">Button goes to</label><input id="b_link" list="links" value="${esc(b.link)}"><datalist id="links">${links.map((l) => `<option value="${esc(l[0])}">${esc(l[1])}</option>`).join('')}</datalist></div></div>
      <div class="fld"><label class="l">Banner picture <span class="muted" style="font-weight:400">— PNG with transparent background looks best (wide, about 1000×700)</span></label><div class="photos" id="bimg"></div><input type="file" id="b_file" accept="image/*" hidden></div>
      <div class="togs"><label><span class="sw"><input type="checkbox" id="b_act" ${b.active ? 'checked' : ''}><span></span></span> Show on store</label></div>`;
    const m = modal(isNew ? 'Add banner' : 'Edit banner', body, async () => {
      const payload = { tag: $('#b_tag').value, bg: $('#b_bg').value, title: $('#b_title').value, subtitle: $('#b_sub').value, buttonText: $('#b_btn').value, link: $('#b_link').value, image, active: $('#b_act').checked };
      if (isNew) await api('banners', 'POST', payload); else await api('banners/' + b.id, 'PUT', payload); toast('Banner saved'); vBanners();
    });
    const draw = () => { $('#bimg', m.el).innerHTML = (image ? `<div class="ph" style="width:150px"><div class="im" style="height:100px"><img src="${esc(image)}" alt="" style="object-fit:contain"></div><div class="ctl"><button data-rm aria-label="Remove">${icon('trash', 14)}</button></div></div>` : '') + `<div class="up" id="bup">${icon('upload', 22)}<div style="margin-top:6px">${image ? 'Replace' : 'Upload'}<br>picture</div></div>`; };
    draw();
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) { image = ''; draw(); } if (e.target.closest('#bup')) $('#b_file', m.el).click(); });
    $('#b_file', m.el).addEventListener('change', async (e) => { const f = Array.from(e.target.files); if (!f.length) return; try { // keep PNG transparency for banner art
      const fr = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f[0]); }); const keep = /^data:image\/(png|webp)/.test(fr) && fr.length < 4e6; const data = keep ? fr : await fileToDataUrl(f[0], 1400); image = (await api('upload', 'POST', { data })).url; } catch (ex) { toast(ex.message); } draw(); e.target.value = ''; });
  }

  /* ------------------------------------------------------------ categories */
  async function vCats() {
    cats = await api('categories');
    $('#view').innerHTML = head('Categories', addBtn('addc', 'Add category')) + `<div class="tbl-wrap"><table><thead><tr><th>Category</th><th>Products</th><th style="text-align:right">Actions</th></tr></thead><tbody>${cats.map((c) => `<tr><td><div class="pcell"><span class="stat" style="padding:0;border:0"><span class="ico" style="width:40px;height:40px">${icon(c.icon, 20)}</span></span><b>${esc(c.name)}</b></div></td><td>${c.count}</td><td style="text-align:right"><button class="iconbtn" data-ce="${c.id}" aria-label="Edit">${icon('edit', 16)}</button><button class="iconbtn red" data-cd="${c.id}" aria-label="Delete">${icon('trash', 16)}</button></td></tr>`).join('')}</tbody></table></div>`;
    bindMenu(); $('#addc').addEventListener('click', () => catModal());
    $('#view').onclick = (e) => { const ce = e.target.closest('[data-ce]'), cd = e.target.closest('[data-cd]'); if (ce) catModal(cats.find((c) => c.id === +ce.dataset.ce)); if (cd) { const c = cats.find((x) => x.id === +cd.dataset.cd); confirmBox(`Delete category <b>${esc(c.name)}</b>?`, async () => { await api('categories/' + c.id, 'DELETE'); toast('Category deleted'); vCats(); }); } };
  }
  function catModal(c) {
    const isNew = !c; let ic = c ? c.icon : 'bag';
    const m = modal(isNew ? 'Add category' : 'Edit category', `<div class="fld"><label class="l">Category name *</label><input id="c_name" value="${esc(c ? c.name : '')}"></div><label class="l">Icon</label><div class="icons" id="icons"></div>`, async () => {
      const payload = { name: $('#c_name').value, icon: ic }; if (isNew) await api('categories', 'POST', payload); else await api('categories/' + c.id, 'PUT', payload); toast('Category saved'); vCats();
    }, { sm: true });
    const draw = () => { $('#icons', m.el).innerHTML = window.CAT_ICONS.map((n) => `<button type="button" data-ic="${n}" class="${n === ic ? 'on' : ''}" aria-label="${n}">${icon(n, 22)}</button>`).join(''); }; draw();
    $('#icons', m.el).addEventListener('click', (e) => { const b = e.target.closest('[data-ic]'); if (b) { ic = b.dataset.ic; draw(); } });
  }

  /* ---------------------------------------------------------------- orders */
  async function vOrders() {
    const list = await api('orders');
    $('#view').innerHTML = head('Orders') + (list.length ? `<div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>${list.map((o) => `<tr><td><b>${esc(o.number)}</b><small class="muted" style="display:block">${when(o.createdAt)}</small></td><td>${esc(o.customer.name)}<small class="muted" style="display:block">${esc(o.customer.phone)}</small></td><td><b>${money(o.total)}</b></td>
      <td>${o.payment === 'mpesa' ? 'M-Pesa' : 'Cash on delivery'}<br><label style="display:flex;gap:8px;align-items:center;margin-top:4px;font-size:12px"><span class="sw" style="transform:scale(.8);transform-origin:left"><input type="checkbox" data-paid="${o.id}" ${o.paid ? 'checked' : ''}><span></span></span>${o.paid ? 'Paid' : 'Unpaid'}</label></td>
      <td><select data-st="${o.id}" style="width:140px;padding:9px 10px">${['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'].map((s) => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td style="text-align:right"><button class="iconbtn" data-view="${o.id}" aria-label="View">${icon('eye', 16)}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card center muted">No orders yet. They’ll appear here when customers check out.</div>');
    bindMenu();
    $('#view').onchange = async (e) => { const s = e.target.closest('[data-st]'), p = e.target.closest('[data-paid]'); try { if (s) { await api('orders/' + s.dataset.st, 'PATCH', { status: s.value }); toast('Status updated'); } if (p) { await api('orders/' + p.dataset.paid, 'PATCH', { paid: p.checked }); toast('Payment updated'); vOrders(); } } catch (ex) { toast(ex.message); } };
    $('#view').onclick = (e) => { const v = e.target.closest('[data-view]'); if (!v) return; const o = list.find((x) => x.id === +v.dataset.view);
      modal(`Order ${esc(o.number)}`, `<p class="muted" style="margin-bottom:14px">${when(o.createdAt)} · ${statusPill(o.status)}</p>${o.items.map((i) => `<div class="row"><img src="${esc(i.image)}" alt=""><div class="grow"><b>${esc(i.name)}</b><div class="muted">${esc(i.color)} · Qty ${i.qty}</div></div><b>${money(i.price * i.qty)}</b></div>`).join('')}
      <div class="row"><div class="grow muted">Delivery — ${esc(o.zone)}</div><b>${o.delivery ? money(o.delivery) : 'FREE'}</b></div><div class="row"><div class="grow"><b>Total</b></div><b style="font-size:18px">${money(o.total)}</b></div>
      <h3 style="margin:20px 0 8px;font-size:15px">Customer</h3><p><b>${esc(o.customer.name)}</b> · <a href="tel:${esc(o.customer.phone)}" style="color:var(--g700)">${esc(o.customer.phone)}</a></p><p class="muted">${esc([o.customer.town, o.customer.address].filter(Boolean).join(', ')) || 'No address given'}</p>${o.customer.notes ? `<p style="margin-top:8px"><b>Notes:</b> ${esc(o.customer.notes)}</p>` : ''}
      <p style="margin-top:16px"><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${esc(o.customer.phone.replace(/\D/g, '').replace(/^0/, '254'))}">${icon('whatsapp', 16)} WhatsApp customer</a></p>`, null, { sm: true }); };
  }

  /* -------------------------------------------------------------- messages */
  async function vMsgs() {
    const list = await api('messages');
    $('#view').innerHTML = head('Messages') + `<div class="card">${list.length ? list.map((m) => `<div class="msg ${m.read ? '' : 'unread'}"><div style="display:flex;justify-content:space-between;gap:10px"><div><b class="n">${esc(m.name)}</b> <span class="muted">${esc([m.phone, m.email].filter(Boolean).join(' · '))}</span></div><span class="muted">${when(m.createdAt)}</span></div><p style="margin:8px 0;white-space:pre-line">${esc(m.message)}</p><div>${m.read ? '' : `<button class="btn sm ghost" data-rd="${m.id}">Mark as read</button> `}<button class="btn sm ghost" data-dm="${m.id}">Delete</button>${m.phone ? ` <a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/${esc(m.phone.replace(/\D/g, '').replace(/^0/, '254'))}">WhatsApp</a>` : ''}</div></div>`).join('') : '<div class="center muted">No messages yet.</div>'}</div>`;
    bindMenu();
    $('#view').onclick = async (e) => { const r = e.target.closest('[data-rd]'), d = e.target.closest('[data-dm]'); if (r) { await api('messages/' + r.dataset.rd, 'PATCH', {}); vMsgs(); renderNav(); } if (d) { await api('messages/' + d.dataset.dm, 'DELETE'); vMsgs(); renderNav(); } };
  }

  /* -------------------------------------------------------------- settings */
  async function vSettings() {
    const s = await api('settings');
    const F = (k, label, hint, type) => `<div class="fld"><label class="l">${label}</label><input data-s="${k}" value="${esc(s[k])}" ${type ? `type="${type}"` : ''}>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
    $('#view').innerHTML = head('Settings') + `<div class="two" style="align-items:start"><div class="card"><h3>Store &amp; contact details</h3><div id="sok"></div>
      ${F('storeName', 'Store name')}${F('tagline', 'Tagline')}${F('topBar', 'Top announcement bar')}
      <div class="f2">${F('phone', 'Phone number', 'Shown on the website and footer')}${F('whatsapp', 'WhatsApp number', 'International format, digits only e.g. 2547XXXXXXXX')}${F('email', 'Email')}${F('address', 'Address / location')}${F('hours', 'Opening hours')}${F('twitter', 'X (Twitter) username', 'Without the @')}${F('instagram', 'Instagram username', 'Without the @')}</div>${F('facebook', 'Facebook page link (optional)')}
      <h3 style="margin-top:8px">Promo code &amp; sale</h3><div class="f2">${F('couponCode', 'Promo code', 'Customers enter this at checkout. Leave empty to switch off.')}${F('couponPercent', 'Discount %', '', 'number')}</div><div class="f2">${F('saleTitle', 'Sale title', 'Shown on the home page offers panel')}${F('saleEnds', 'Sale ends', 'Format: 2026-11-30T23:59:00+03:00 — shows a countdown')}</div>
      <h3 style="margin-top:8px">M-Pesa payment details</h3><div class="f2"><div class="fld"><label class="l">Type</label><select data-s="mpesaType">${['Till Number', 'Paybill', 'Send Money (phone number)'].map((t) => `<option ${s.mpesaType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>${F('mpesaNumber', 'Till / Paybill / phone number')}</div>${F('mpesaName', 'Registered business name')}
      <div class="fld"><label class="l">Delivery areas &amp; fees</label><textarea data-s="deliveryZones" style="min-height:120px">${esc(s.deliveryZones)}</textarea><div class="hint">One per line: <b>Area name|fee</b> — use 0 for free delivery. Example: Nairobi CBD (same-day)|0</div></div>
      <button class="btn" id="ssave">Save settings</button></div>
      <div class="card"><h3>Change admin password</h3><div id="pwmsg"></div><div class="fld"><label class="l">Current password</label><input type="password" id="pw0" autocomplete="current-password"></div><div class="fld"><label class="l">New password</label><input type="password" id="pw1" autocomplete="new-password"><div class="hint">At least 8 characters.</div></div><button class="btn" id="pwsave">Update password</button></div></div>`;
    bindMenu();
    $('#view').insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:18px"><h3>Backup &amp; data</h3>
      <p class="hint" style="margin-bottom:14px">Products, banners, orders and settings are saved <b>inside this browser</b>. Download a backup before clearing your browser data, or to move the shop to another computer.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="bk">Download backup</button><button class="btn ghost" id="rs">Restore from backup…</button><input type="file" id="rsf" accept=".json,application/json" hidden><button class="btn danger" id="rst">Reset to sample data</button></div></div>`);
    $('#bk').addEventListener('click', async () => { const d = await api('backup'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = 'clutch-bags-kenya-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Backup downloaded'); });
    $('#rs').addEventListener('click', () => $('#rsf').click());
    $('#rsf').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); await api('restore', 'POST', { db: d }); toast('Backup restored'); vSettings(); } catch (ex) { toast(ex.message.includes('JSON') ? 'That file is not a valid backup.' : ex.message); } e.target.value = ''; });
    $('#rst').addEventListener('click', () => confirmBox('Reset everything to the sample catalogue? Your products, banners, orders and settings will be erased.', async () => { await api('reset', 'POST'); toast('Reset to sample data'); logout(); }));
    $('#ssave').addEventListener('click', async () => { const b = {}; $$('[data-s]').forEach((el) => { b[el.dataset.s] = el.value; }); try { await api('settings', 'PUT', b); toast('Settings saved'); } catch (ex) { $('#sok').innerHTML = `<div class="err">${esc(ex.message)}</div>`; } });
    $('#pwsave').addEventListener('click', async () => { try { await api('password', 'POST', { current: $('#pw0').value, next: $('#pw1').value }); $('#pwmsg').innerHTML = '<div class="ok">Password updated.</div>'; $('#pw0').value = $('#pw1').value = ''; } catch (ex) { $('#pwmsg').innerHTML = `<div class="err">${esc(ex.message)}</div>`; } });
  }

  if (token) start(); else loginScreen();
})();
