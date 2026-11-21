/* Clutch Bags Kenya — storefront (single-page app, hash routing) */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => 'KSh ' + Math.round(n).toLocaleString('en-KE');
  const ls = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const SLIDE_MS = 5500;   // product pictures change every 5.5 seconds
  const HERO_MS = 6500;    // home banners change every 6.5 seconds

  let S = null;
  let cart = ls.get('cbk_cart', []);
  let wish = ls.get('cbk_wish', []);
  let recent = ls.get('cbk_recent', []);
  let timers = [];
  let lastPath = null;
  let pdp = null;      // product page state
  let qvs = null;      // quick-view state
  let shopState = null; // pagination for the shop grid

  const catById = (id) => S.categories.find((c) => c.id === id);
  const catBySlug = (s) => S.categories.find((c) => c.slug === s);
  const prodById = (id) => S.products.find((p) => p.id === +id);
  const zones = () => String(S.settings.deliveryZones || '').split('\n').map((l) => l.split('|')).filter((p) => p[0] && p[0].trim()).map((p) => ({ name: p[0].trim(), fee: Number(p[1]) || 0 }));
  const waLink = (text) => `https://wa.me/${S.settings.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  const telLink = () => 'tel:' + String(S.settings.phone).replace(/[^\d+]/g, '');
  const pct = (p) => (p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
  const onOffer = () => S.products.filter((p) => p.oldPrice > p.price).sort((a, b) => pct(b) - pct(a));
  const COL = { Gold: '#d9b45a', Silver: '#cfd4da', Black: '#1c1c1f', 'Rose Gold': '#e3a998', Emerald: '#1f8a63', 'Emerald Print': '#0f7a52', Champagne: '#ecd6a2', Navy: '#1f3a74', 'Royal Blue': '#1d3f9a', 'Ruby Red': '#c8283a', Burgundy: '#7a1f3d', Nude: '#e0bda3', 'Blush Pink': '#f2b9c6', White: '#ffffff', Ivory: '#f3ecd8', Tan: '#b97c43', Olive: '#6f7d3e', Pink: '#ec5f95', Plum: '#7a2f5c', Natural: '#d9c08a', Sunset: '#f08a24', Fuchsia: '#d6247d', Kente: '#e0a82e', 'Maasai Red': '#c62828', Multicolour: 'conic-gradient(#e63946,#f2b134,#2b6cb0,#2a9566,#e63946)', Teal: '#1f8c84', Lilac: '#b79be0', Mustard: '#d9a62c', Coral: '#f2705f', Bronze: '#b9803f', 'Sage Green': '#8fab87', 'Cobalt Blue': '#2850b8', 'Teal Print': '#0e7c86', 'Purple Print': '#5b2a86', 'Blue Beaded': '#1565c0', Red: '#c8283a', Blue: '#2850b8', Green: '#1f8a63', Brown: '#7a4a2a', Grey: '#9aa0a6', Gray: '#9aa0a6', Yellow: '#e9c33a', Orange: '#f08a24', Purple: '#6b3fa0' };
  const dot = (n) => { const c = COL[n] || '#c9cfcb'; return c.startsWith('conic') ? `background:${c}` : `background:${c}`; };

  function toast(msg) {
    const t = $('#toast'); t.innerHTML = icon('check', 16) + esc(msg); t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ------------------------------------------------------------- cart */
  const cartCount = () => cart.reduce((s, i) => s + i.qty, 0);
  const cartLines = () => cart.map((i) => ({ ...i, p: prodById(i.id) })).filter((i) => i.p);
  const cartSub = () => cartLines().reduce((s, i) => s + i.p.price * i.qty, 0);
  function saveCart() { ls.set('cbk_cart', cart); updateBadges(); if ($('#cartd').classList.contains('open')) renderCartDrawer(); }
  function addToCart(id, color, qty) {
    const p = prodById(id); if (!p) return false;
    qty = qty || 1;
    const ex = cart.find((i) => i.id === p.id && i.color === (color || p.colors[0] || ''));
    const have = cart.filter((i) => i.id === p.id).reduce((s, i) => s + i.qty, 0);
    if (have + qty > p.stock) { toast(p.stock ? `Only ${p.stock} in stock` : 'Sorry, this item is sold out'); return false; }
    if (ex) ex.qty += qty; else cart.push({ id: p.id, color: color || (p.colors[0] || ''), qty });
    saveCart(); return true;
  }
  function toggleWish(id) {
    id = +id; const i = wish.indexOf(id);
    if (i >= 0) { wish.splice(i, 1); toast('Removed from wishlist'); } else { wish.push(id); toast('Saved to wishlist'); }
    ls.set('cbk_wish', wish); updateBadges();
    $$(`.wish[data-id="${id}"]`).forEach((b) => b.classList.toggle('on', wish.includes(id)));
  }
  function updateBadges() {
    const c = $('#cartcount'), w = $('#wishcount'), l = $('#cartlbl');
    if (c) { c.textContent = cartCount(); c.style.display = cartCount() ? '' : 'none'; }
    if (w) { w.textContent = wish.length; w.style.display = wish.length ? '' : 'none'; }
    if (l) l.textContent = cartCount() ? money(cartSub()) : 'Cart';
  }
  function pushRecent(id) { recent = [+id, ...recent.filter((x) => x !== +id)].slice(0, 10); ls.set('cbk_recent', recent); }

  /* ------------------------------------------------------- components */
  function cardHTML(p) {
    const c = catById(p.categoryId); const imgs = p.images.length ? p.images : ['img/logo.png']; const sale = pct(p);
    const cols = p.colors.slice(0, 4).map((x) => `<i title="${esc(x)}" style="${dot(x)}"></i>`).join('');
    return `<article class="card">
      ${p.badge ? `<span class="pbadge">${esc(p.badge)}</span>` : ''}${sale ? `<span class="psale">-${sale}%</span>` : ''}
      <button class="wish ${wish.includes(p.id) ? 'on' : ''}" data-act="wish" data-id="${p.id}" aria-label="Save to wishlist">${icon('heart', 18)}</button>
      <button class="qv" data-act="quick" data-id="${p.id}" aria-label="Quick view">${icon('eye', 18)}</button>
      <a class="pslider" href="#/product/${p.id}">
        ${imgs.map((s, i) => `<img class="im ${i === 0 ? 'on' : ''}" src="${esc(s)}" alt="${esc(p.name)}" loading="lazy">`).join('')}
        ${imgs.length > 1 ? `<div class="pdots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}
        ${p.stock < 1 ? '<div class="sold">Sold out</div>' : ''}
      </a>
      <div class="cbody">
        <div class="ccat">${esc(c ? c.name : '')}</div>
        <a class="cname" href="#/product/${p.id}">${esc(p.name)}</a>
        ${p.colors.length ? `<div class="sws">${cols}${p.colors.length > 4 ? `<em>+${p.colors.length - 4}</em>` : ''}</div>` : ''}
        <div class="price"><b>${money(p.price)}</b>${sale ? `<s>${money(p.oldPrice)}</s>` : ''}</div>
        <button class="add" data-act="add" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${icon('cart', 17)}<span>Add to cart</span></button>
      </div>
    </article>`;
  }
  const gridHTML = (list, cls) => `<div class="grid ${cls || ''}">${list.length ? list.map(cardHTML).join('') : '<div class="empty">No clutches found. Try clearing your filters.</div>'}</div>`;
  const rv = (cls, d) => `rv ${cls || ''}" style="--d:${d || 0}s`;
  const secHead = (title, sub, link, label) => `<div class="sec-head ${rv('', 0)}"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${link ? `<a class="more" href="${link}">${label || 'View all'} ${icon('arrow', 16)}</a>` : ''}</div>`;
  const scroller = (list, id) => `<div class="scroller"><button class="sc-btn l" data-act="scroll" data-dir="-1" data-target="#${id}" aria-label="Scroll left">${icon('left', 20)}</button><div class="sc-track" id="${id}">${list.map(cardHTML).join('')}</div><button class="sc-btn r" data-act="scroll" data-dir="1" data-target="#${id}" aria-label="Scroll right">${icon('right', 20)}</button></div>`;
  const cover = (slug, n) => { const p = S.products.filter((x) => { const c = catBySlug(slug); return c && x.categoryId === c.id; })[0]; return p ? (p.images[n == null ? 1 : n] || p.images[0]) : 'img/logo.png'; };

  /* product pictures rotate every 5.5 s (staggered, cross-fade) */
  function startSliders(root) {
    $$('.pslider', root).forEach((el) => {
      if (el._s) return; const imgs = $$('.im', el); if (imgs.length < 2) return; el._s = 1;
      const dots = $$('.pdots i', el); let i = 0;
      const go = (n) => { imgs[i].classList.remove('on'); dots[i] && dots[i].classList.remove('on'); i = (n + imgs.length) % imgs.length; imgs[i].classList.add('on'); dots[i] && dots[i].classList.add('on'); };
      timers.push(setTimeout(() => timers.push(setInterval(() => { if (!document.hidden && !el.matches(':hover')) go(i + 1); }, SLIDE_MS)), Math.random() * 3500));
    });
  }

  /* ------------------------------------------------------ header/footer */
  function renderHeader() {
    const s = S.settings; const hash = location.hash || '#/';
    const curCat = (hash.match(/cat=([^&]+)/) || [])[1]; const isShop = hash.startsWith('#/shop'); const isOffers = hash.startsWith('#/offers');
    const qv = (hash.match(/[?&]q=([^&]*)/) || [])[1];
    $('#hdr').innerHTML = `
      <div class="topbar" id="topbar">${String(s.topBar).split('•').map((m, i) => `<span class="${i === 0 ? 'on' : ''}">${esc(m.trim())}</span>`).join('')}</div>
      <header class="header" id="header">
        <div class="wrap row">
          <button class="burger" data-act="menu-open" aria-label="Open menu">${icon('menu', 24)}</button>
          <a class="logo" href="#/" aria-label="${esc(s.storeName)} home"><img src="img/logo.png" alt="${esc(s.storeName)}"></a>
          <form class="search" id="sf" role="search" autocomplete="off"><input id="q" type="search" placeholder="Search clutch bags, colours, categories..." value="${esc(qv ? decodeURIComponent(qv) : '')}" aria-label="Search"><button aria-label="Search">${icon('search', 18)}</button><div class="sugg" id="sugg"></div></form>
          <div class="hactions">
            <a href="#/contact" aria-label="Contact us">${icon('phone', 20)}<span class="lbl">Contact us</span></a>
            <a href="#/wishlist" aria-label="Wishlist">${icon('heart', 21)}<span class="badge" id="wishcount"></span></a>
            <button data-act="cart-open" aria-label="Open cart">${icon('cart', 21)}<span class="lbl" id="cartlbl">Cart</span><span class="badge" id="cartcount"></span></button>
          </div>
        </div>
        <nav class="nav" aria-label="Categories"><div class="wrap">
          <a href="#/shop" class="${isShop && !curCat ? 'on' : ''}">All Clutches</a>
          ${S.categories.map((c) => `<a href="#/shop?cat=${c.slug}" class="${curCat === c.slug ? 'on' : ''}">${esc(c.name)}</a>`).join('')}
          <a href="#/offers" class="hot ${isOffers ? 'on' : ''}">${icon('flame', 16)} Offers</a>
        </div></nav>
      </header>`;
    updateBadges();
    $('#sf').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#q').value.trim(); $('#sugg').classList.remove('open'); location.hash = q ? `#/shop?q=${encodeURIComponent(q)}` : '#/shop'; });
    initSearch();
  }

  function initSearch() {
    const inp = $('#q'), box = $('#sugg'); let hl = -1;
    const show = () => {
      const t = inp.value.trim().toLowerCase(); hl = -1; if (t.length < 2) { box.classList.remove('open'); return; }
      const words = t.split(/\s+/);
      const hits = S.products.filter((p) => { const c = catById(p.categoryId); const h = (p.name + ' ' + p.colors.join(' ') + ' ' + (c ? c.name : '')).toLowerCase(); return words.every((w) => h.includes(w)); }).slice(0, 6);
      box.innerHTML = hits.length ? hits.map((p) => `<a href="#/product/${p.id}"><img src="${esc(p.images[0] || 'img/logo.png')}" alt=""><div><b>${esc(p.name)}</b><span>${money(p.price)}</span></div></a>`).join('') + `<a class="all" href="#/shop?q=${encodeURIComponent(inp.value.trim())}">See all results ${icon('arrow', 15)}</a>` : `<div style="padding:16px;color:var(--mut)">No matches for “${esc(inp.value.trim())}”. Try “gold”, “bridal” or “leather”.</div>`;
      box.classList.add('open');
    };
    inp.addEventListener('input', show); inp.addEventListener('focus', show);
    inp.addEventListener('keydown', (e) => {
      const items = $$('a', box); if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((a, i) => a.classList.toggle('hl', i === hl)); }
      else if (e.key === 'Enter' && hl >= 0) { e.preventDefault(); box.classList.remove('open'); location.hash = items[hl].getAttribute('href'); }
      else if (e.key === 'Escape') box.classList.remove('open');
    });
  }

  const FAQS = [
    ['How do I place an order?', 'Add your favourite clutches to the cart, go to checkout, enter your delivery details and place the order. You can also order directly on WhatsApp — just send us the name of the clutch.'],
    ['How does M-Pesa payment work?', 'After you place your order you will see our M-Pesa details and your order reference. Pay on your phone, then send us the confirmation message on WhatsApp and we will dispatch right away. Cash on delivery is also available.'],
    ['Do you deliver outside Nairobi?', 'Yes. We deliver countrywide by courier and bus parcel. The delivery fee for your area is shown at checkout.'],
    ['How fast is delivery?', 'Orders for Nairobi CBD are delivered the same day, free of charge. For other areas we confirm the timing with you when we call or WhatsApp to confirm your order.'],
    ['Can I choose a colour or order in bulk?', 'Yes — pick a colour on the product page or add a note at checkout. For bridesmaid sets, corporate gifts or special colours, chat with us on WhatsApp and we will sort you out.'],
    ['What if my clutch is faulty or not what I ordered?', 'Contact us as soon as it arrives with a photo and your order number. We will arrange an exchange or refund where the item is faulty or different from what you ordered.'],
    ['How do I look after my clutch?', 'Wipe gently with a soft dry cloth, keep it away from water and direct sunlight, and store it in a dust bag so it keeps its shape and shine.'],
    ['Can I track my order?', 'Yes. Open “Track order” in the menu or footer and enter your order number and phone number to see where your order is.'],
  ];
  const faqHTML = (list) => list.map((f, i) => `<details ${i === 0 && list.length > 6 ? 'open' : ''}><summary>${esc(f[0])}${icon('down', 20)}</summary><div class="ans">${esc(f[1])}</div></details>`).join('');

  function footerHTML() {
    const s = S.settings;
    return `<footer class="footer"><div class="wrap">
      <div class="cols">
        <div><img src="img/logo.png" alt="${esc(s.storeName)}"><p>${esc(s.tagline)} Free same-day delivery in Nairobi CBD and countrywide shipping. Pay with M-Pesa or cash on delivery.</p>
          <div class="soc">${s.twitter ? `<a href="https://x.com/${esc(s.twitter)}" target="_blank" rel="noopener" aria-label="X (Twitter)">${icon('xsocial', 17)}</a>` : ''}${s.instagram ? `<a href="https://instagram.com/${esc(s.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram', 18)}</a>` : ''}${s.facebook ? `<a href="${esc(s.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${icon('facebook', 18)}</a>` : ''}<a href="${waLink()}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp', 18)}</a></div>
          <div class="pays"><span class="mp2">M-PESA</span><span>CASH ON DELIVERY</span></div></div>
        <div><h5>SHOP</h5><a href="#/shop">All clutches</a>${S.categories.slice(0, 6).map((c) => `<a href="#/shop?cat=${c.slug}">${esc(c.name)}</a>`).join('')}<a href="#/offers">Offers &amp; deals</a></div>
        <div><h5>HELP</h5><a href="#/track">Track your order</a><a href="#/delivery">Delivery &amp; returns</a><a href="#/faq">FAQs</a><a href="#/about">About us</a><a href="#/contact">Contact us</a><a href="#/wishlist">Wishlist</a><a href="#/cart">Shopping cart</a></div>
        <div><h5>CONTACT</h5>
          <div class="ci">${icon('phone', 17)}<a href="${telLink()}">${esc(s.phone)}</a></div>
          <div class="ci">${icon('whatsapp', 17)}<a href="${waLink()}" target="_blank" rel="noopener">WhatsApp us</a></div>
          <div class="ci">${icon('mail', 17)}<a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div>
          <div class="ci">${icon('pin', 17)}<span>${esc(s.address)}</span></div>
          <div class="ci">${icon('clock', 17)}<span>${esc(s.hours)}</span></div></div>
      </div>
      <div class="copy"><span>© ${new Date().getFullYear()} ${esc(s.storeName)}. All rights reserved.</span><span><a href="#/privacy">Privacy</a> • <a href="#/terms">Terms</a> • <a href="#/admin">Admin</a></span></div>
    </div></footer>
    <div class="wabub" id="wabub"><button data-act="closebub" aria-label="Close">${icon('x', 14)}</button>Need help choosing a clutch? <a href="${waLink('Hello Clutch Bags Kenya, I need help choosing a clutch.')}" target="_blank" rel="noopener" style="color:var(--g700);font-weight:700">Chat with us</a></div>
    <a class="wafab" href="${waLink('Hello Clutch Bags Kenya, I would like to order a clutch.')}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${icon('whatsapp', 30)}</a>
    <button class="totop" id="totop" data-act="top" aria-label="Back to top">${icon('up', 20)}</button>`;
  }

  /* --------------------------------------------------- drawers & modals */
  function openOverlay(open) { $('#ov').classList.toggle('open', open); document.body.classList.toggle('lock', open || $('#mb').classList.contains('open')); }
  function closeAll() { ['#cartd', '#menud'].forEach((s) => $(s).classList.remove('open')); $('#mb').classList.remove('open'); $('#lbx').classList.remove('open'); openOverlay(false); document.body.classList.remove('lock'); }
  function renderCartDrawer() {
    const lines = cartLines(); const sub = cartSub(); const z = zones(); const free = z.find((x) => x.fee === 0);
    $('#cartd').innerHTML = `<div class="drawer-h"><h3>Your cart (${cartCount()})</h3><button class="iconbtn" data-act="close-all" aria-label="Close cart">${icon('x', 20)}</button></div>
      <div class="drawer-b">${lines.length ? `${free ? `<div class="freebar">${icon('truck', 17)} ${esc(S.settings.freeDeliveryNote || free.name)}</div>` : ''}` + lines.map((i, n) => `<div class="dline"><a href="#/product/${i.p.id}"><img src="${esc(i.p.images[0] || 'img/logo.png')}" alt=""></a>
        <div><b>${esc(i.p.name)}</b><span>${esc(i.color)}${i.color ? ' · ' : ''}${money(i.p.price)}</span>
          <div class="qty" style="height:36px;margin-top:8px;width:max-content"><button data-q="${n}" data-d="-1" aria-label="Less" style="width:34px">${icon('minus', 14)}</button><span>${i.qty}</span><button data-q="${n}" data-d="1" aria-label="More" style="width:34px">${icon('plus', 14)}</button></div></div>
        <button class="rm" data-rm="${n}" aria-label="Remove">${icon('trash', 17)}</button></div>`).join('') : `<div class="empty" style="margin-top:20px">${icon('cart', 40)}<br><br>Your cart is empty.<br><br><a class="btn sm" href="#/shop" data-act="close-all">Start shopping</a></div>`}</div>
      ${lines.length ? `<div class="drawer-f"><div class="sumrow t" style="border:0;margin:0;padding:0 0 14px"><span>Subtotal</span><span>${money(sub)}</span></div><a class="btn block" href="#/checkout" data-act="close-all">Checkout ${icon('arrow', 18)}</a><div style="height:10px"></div><a class="btn line block" href="#/cart" data-act="close-all">View full cart</a></div>` : ''}`;
  }
  function openCartDrawer() { renderCartDrawer(); $('#cartd').classList.add('open'); openOverlay(true); }
  function renderMenuDrawer() {
    const L = (h, ic, t) => `<a href="${h}" data-act="close-all">${icon(ic, 19)} ${t}</a>`;
    $('#menud').innerHTML = `<div class="drawer-h"><a href="#/" data-act="close-all"><img src="img/logo.png" alt="" style="height:44px"></a><button class="iconbtn" data-act="close-all" aria-label="Close menu">${icon('x', 20)}</button></div>
      <div class="drawer-b mnav">${L('#/', 'home', 'Home')}${L('#/shop', 'grid', 'All clutches')}${L('#/offers', 'flame', 'Offers &amp; deals')}${S.categories.map((c) => L('#/shop?cat=' + c.slug, c.icon, esc(c.name))).join('')}${L('#/track', 'box', 'Track your order')}${L('#/delivery', 'truck', 'Delivery &amp; returns')}${L('#/about', 'info', 'About us')}${L('#/faq', 'help', 'FAQs')}${L('#/wishlist', 'heart', 'Wishlist')}${L('#/contact', 'phone', 'Contact us')}</div>`;
  }
  function openModal(html, cls) { $('#mb').innerHTML = `<div class="modal ${cls || ''}" role="dialog" aria-modal="true"><button class="close" data-act="close-all" aria-label="Close">${icon('x', 20)}</button>${html}</div>`; $('#mb').classList.add('open'); document.body.classList.add('lock'); }

  function openQuick(id) {
    const p = prodById(id); if (!p) return; const c = catById(p.categoryId); const imgs = p.images.length ? p.images : ['img/logo.png']; const sale = pct(p);
    qvs = { id: p.id, qty: 1, color: p.colors[0] || '' };
    openModal(`<div class="qvg"><div class="pmain" id="qvmain">${imgs.map((s, i) => `<img class="im ${i === 0 ? 'on' : ''}" src="${esc(s)}" alt="${esc(p.name)}">`).join('')}${p.badge ? `<span class="pbadge">${esc(p.badge)}</span>` : ''}</div>
      <div class="pinfo"><div class="ccat">${esc(c ? c.name : '')}</div><h1>${esc(p.name)}</h1>
        <div class="pr"><b>${money(p.price)}</b>${sale ? `<s>${money(p.oldPrice)}</s><em>-${sale}%</em>` : ''}</div>
        <p class="d" style="font-size:14.5px">${esc(p.description.length > 190 ? p.description.slice(0, 190) + '…' : p.description)}</p>
        ${p.colors.length ? `<div class="opt"><label>Colour: <span id="qvcol">${esc(qvs.color)}</span></label><div class="swatches">${p.colors.map((x, i) => `<button data-act="qv-color" data-c="${esc(x)}" class="${i === 0 ? 'on' : ''}"><i style="${dot(x)}"></i>${esc(x)}</button>`).join('')}</div></div>` : ''}
        <div class="buyrow"><div class="qty"><button data-act="qv-qty" data-d="-1" aria-label="Less">${icon('minus', 16)}</button><span id="qvq">1</span><button data-act="qv-qty" data-d="1" aria-label="More">${icon('plus', 16)}</button></div>
          <button class="btn" data-act="qv-add" ${p.stock < 1 ? 'disabled' : ''}>${icon('cart', 18)} Add to cart</button></div>
        <a class="btn line block" href="#/product/${p.id}" data-act="close-all">View full details ${icon('arrow', 16)}</a></div></div>`);
    if (imgs.length > 1) { const main = $('#qvmain'); const im = $$('.im', main); let i = 0; const t = setInterval(() => { if (!document.body.contains(main)) return clearInterval(t); im[i].classList.remove('on'); i = (i + 1) % im.length; im[i].classList.add('on'); }, SLIDE_MS); }
  }
  function openLightbox(srcs, i) {
    const box = $('#lbx'); box._s = srcs; box._i = i;
    const draw = () => { box.innerHTML = `<button class="x" data-act="close-all" aria-label="Close">${icon('x', 22)}</button>${srcs.length > 1 ? `<button class="pv" data-act="lb" data-d="-1" aria-label="Previous">${icon('left', 22)}</button><button class="nx" data-act="lb" data-d="1" aria-label="Next">${icon('right', 22)}</button>` : ''}<img src="${esc(srcs[box._i])}" alt="">`; };
    box._draw = draw; draw(); box.classList.add('open'); document.body.classList.add('lock');
  }

  /* ----------------------------------------------------------- pages */
  const OCC = [['Weddings & Brides', 'gem', 'bridal-wedding', 'Pearl & crystal'], ['Date Night & Parties', 'sparkles', 'evening-clutches', 'Glam evening'], ['Office & Smart Casual', 'briefcase', 'leather-clutches', 'Leather classics'], ['Church & Events', 'mail', 'envelope-clutches', 'Envelope styles'], ['Culture & Colour', 'globe', 'african-print-beaded', 'Ankara & beaded'], ['Weekend & Travel', 'link', 'crossbody-chain-bags', 'Chain slings']];
  const luma = (hex) => { const h = String(hex || '#fff').replace('#', ''); const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.padEnd(6, 'f'); const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  function dealsHTML() {
    const offers = onOffer(); if (!offers.length) return '';
    const end = Date.parse(S.settings.saleEnds || ''); const live = end > Date.now();
    return `<section class="section"><div class="deal ${rv('pop')}">
      <div class="deal-h"><div><h2>${icon('flame', 30)} ${esc(live ? (S.settings.saleTitle || 'Special offers') : 'Special offers')}</h2><p>${live ? 'Selected clutches at special prices — offer ends soon, while stock lasts.' : 'Selected clutches at reduced prices while stock lasts.'}</p></div>
        ${live ? `<div class="cd" data-cd="${end}"><div><b data-u="d">00</b><span>Days</span></div><div><b data-u="h">00</b><span>Hrs</span></div><div><b data-u="m">00</b><span>Min</span></div><div><b data-u="s">00</b><span>Sec</span></div></div>` : ''}
        <a class="btn gold" href="#/offers">See all offers ${icon('arrow', 18)}</a></div>
      ${scroller(offers.slice(0, 10), 'dealtrack')}</div></section>`;
  }

  function pageHome() {
    const feats = [['truck', 'Free CBD delivery', 'Same-day in Nairobi CBD'], ['wallet', 'Pay with M-Pesa', 'Or cash on delivery'], ['box', 'Countrywide shipping', 'We deliver across Kenya'], ['shield', 'Quality guaranteed', 'Carefully checked clutches']];
    const counts = {}; S.products.forEach((p) => { counts[p.categoryId] = (counts[p.categoryId] || 0) + 1; });
    const lb = S.categories.map((c) => S.products.find((p) => p.categoryId === c.id && p.images[2])).filter(Boolean).slice(0, 6);
    const colours = new Set(); S.products.forEach((p) => p.colors.forEach((c) => colours.add(c)));
    const bands = [['Under KSh 1,000', 0, 999], ['KSh 1,000 – 1,999', 1000, 1999], ['KSh 2,000 – 2,999', 2000, 2999], ['KSh 3,000 & above', 3000, 0]];
    const cheapest = [...S.products].sort((a, b) => a.price - b.price)[0];
    const hero = S.banners.length ? `
      <section class="hero ${S.banners.some((b) => luma(b.bg) < 0.35 && b === S.banners[0]) ? 'hasdark' : ''}" id="hero" aria-label="Featured offers">
        ${S.banners.map((b, i) => `<div class="slide ${i === 0 ? 'on' : ''} ${luma(b.bg) < 0.35 ? 'dark' : ''}" style="--bgc:${esc(b.bg)}" data-dark="${luma(b.bg) < 0.35 ? 1 : 0}">
            ${b.image ? `<div class="bgimg" style="background-image:url('${esc(b.image)}')"></div>` : ''}<div class="fade"></div>
            <div class="wrap"><div class="txt">${b.tag ? `<span class="tag">${esc(b.tag)}</span>` : '<span></span>'}<h1>${esc(b.title)}</h1><p>${esc(b.subtitle)}</p><div><a class="btn" href="${esc(b.link)}">${esc(b.buttonText)} ${icon('arrow', 18)}</a></div></div></div>
          </div>`).join('')}
        ${S.banners.length > 1 ? `<button class="arrow l" data-act="hero" data-d="-1" aria-label="Previous slide">${icon('left', 22)}</button><button class="arrow r" data-act="hero" data-d="1" aria-label="Next slide">${icon('right', 22)}</button>
        <div class="dots">${S.banners.map((_, i) => `<button data-act="hero-go" data-i="${i}" class="${i === 0 ? 'on' : ''}" aria-label="Go to slide ${i + 1}"></button>`).join('')}</div><div class="hcount" id="hcount">01 / ${String(S.banners.length).padStart(2, '0')}</div>` : ''}
        <div class="progress" id="prog"></div>
      </section>` : '';
    const trending = (k) => { const l = k === 'new' ? [...S.products].sort((a, b) => b.createdAt - a.createdAt) : k === 'offer' ? onOffer() : S.products.filter((p) => p.featured); return gridHTML(l.slice(0, 8)); };
    const ticker = ['Free same-day CBD delivery', 'Pay with M-Pesa', 'Countrywide delivery', 'Carefully checked clutches', 'Gift-ready picks', 'Bridal & bridesmaid sets', 'Cash on delivery', 'New designs added often'];
    const tk = ticker.map((t) => `<span>${icon('sparkles', 16)} ${t}</span>`).join('');
    return `${hero}
      <div class="wrap features"><div class="box">${feats.map((f) => `<a class="feat" href="#/delivery">${icon(f[0], 28)}<div><b>${f[1]}</b><span>${f[2]}</span></div></a>`).join('')}</div></div>
      <div class="ticker"><div class="track">${tk}${tk}</div></div>
      <div class="wrap">
        <section class="section">${secHead('Shop by category', 'Find the perfect clutch for every occasion')}
          <div class="catrow">${S.categories.map((c, i) => { const p = S.products.find((x) => x.categoryId === c.id); return `<a class="catc ${rv('pop', i * 0.06)}" href="#/shop?cat=${c.slug}"><div class="im"><img src="${esc(p ? p.images[1] || p.images[0] : 'img/logo.png')}" alt="${esc(c.name)}" loading="lazy"></div><div><b>${esc(c.name)}</b><span>${counts[c.id] || 0} designs</span></div></a>`; }).join('')}</div></section>
        ${dealsHTML()}
        <section class="section"><div class="tiles">
          <a class="tile ${rv('left')}" href="#/shop?cat=bridal-wedding"><img src="${esc(cover('bridal-wedding', 1))}" alt="" loading="lazy"><div><small>BRIDAL &amp; WEDDING</small><h3>Pearl &amp; crystal clutches for your big day</h3><span class="go">Shop bridal ${icon('arrow', 16)}</span></div></a>
          <a class="tile ${rv('', 0.12)}" href="#/shop?cat=african-print-beaded"><img src="${esc(cover('african-print-beaded', 0))}" alt="" loading="lazy"><div><small>MADE IN AFRICA</small><h3>Ankara &amp; beaded colour</h3><span class="go">Shop now ${icon('arrow', 16)}</span></div></a>
          <a class="tile ${rv('right', 0.24)}" href="#/shop?max=1499&sort=price-asc"><img src="${esc(cheapest ? cheapest.images[1] || cheapest.images[0] : 'img/logo.png')}" alt="" loading="lazy"><div><small>PRICE PICKS</small><h3>Pocket-friendly clutches under KSh 1,500</h3><span class="go">Shop now ${icon('arrow', 16)}</span></div></a></div></section>
        <section class="section">${secHead('Trending now', 'What everyone is picking this season', '#/shop', 'View all')}
          <div class="tabs ${rv('')}" id="hometabs"><button class="on" data-act="tab-home" data-k="best">Best sellers</button><button data-act="tab-home" data-k="new">New arrivals</button><button data-act="tab-home" data-k="offer">On offer</button></div><div style="height:20px"></div>
          <div id="tabgrid">${trending('best')}</div></section>
        <section class="section">${secHead('Shop by occasion', 'Wedding, date night or weekend away — we have your clutch')}
          <div class="occ">${OCC.map((o, i) => `<a class="oc ${rv('pop', i * 0.07)}" href="#/shop?cat=${o[2]}"><div class="ico">${icon(o[1], 26)}</div><b>${o[0]}</b><span>${o[3]}</span></a>`).join('')}</div></section>
        <section class="section">${secHead('Shop by budget', 'Beautiful clutches at every price')}
          <div class="pricechips">${bands.map((b, i) => { const n = S.products.filter((p) => p.price >= b[1] && (!b[2] || p.price <= b[2])).length; return `<a class="pc ${rv('pop', i * 0.08)}" href="#/shop?${b[1] ? 'min=' + b[1] : ''}${b[1] && b[2] ? '&' : ''}${b[2] ? 'max=' + b[2] : ''}&sort=price-asc"><div><small>${n} clutches</small><b>${b[0]}</b></div>${icon('arrow', 22)}</a>`; }).join('')}</div></section>
        <section class="section">${secHead('Why shop with us', 'Everything you need for a smooth, happy order')}
          <div class="why">
            <div class="wcard ${rv('pop', 0)}"><div class="ico">${icon('bag', 28)}</div><div class="num" data-count="${S.products.length}">0</div><b>Clutch designs</b><span>Evening, bridal, leather, African print and more</span></div>
            <div class="wcard ${rv('pop', 0.08)}"><div class="ico">${icon('grid', 28)}</div><div class="num" data-count="${S.categories.length}">0</div><b>Categories</b><span>Easy to browse by style or occasion</span></div>
            <div class="wcard ${rv('pop', 0.16)}"><div class="ico">${icon('palette', 28)}</div><div class="num" data-count="${colours.size}">0</div><b>Colours &amp; prints</b><span>From classic black to bold Ankara</span></div>
            <div class="wcard ${rv('pop', 0.24)}"><div class="ico">${icon('truck', 28)}</div><div class="num" data-count="${zones().length}">0</div><b>Delivery options</b><span>Same-day CBD, Nairobi and countrywide</span></div></div></section>
        <section class="section">${secHead('How it works', 'Four easy steps from browsing to your door')}
          <div class="steps">${[['Browse & choose', 'Pick your clutch and colour'], ['Place your order', 'Online or on WhatsApp'], ['Pay your way', 'M-Pesa or cash on delivery'], ['Get it delivered', 'Same-day in the CBD']].map((s, i) => `<div class="step ${rv('', i * 0.1)}"><div class="n">${i + 1}</div><b>${s[0]}</b><span>${s[1]}</span></div>`).join('')}</div></section>
        ${lb.length ? `<section class="section" style="padding-bottom:26px">${secHead('Fresh from the collection', 'A closer look at our latest pieces', S.settings.twitter ? 'https://x.com/' + esc(S.settings.twitter) : '', 'Follow @' + esc(S.settings.twitter || ''))}
          <div class="lookbook">${lb.map((p, i) => `<a class="lb ${rv('pop', i * 0.07)}" href="#/product/${p.id}" aria-label="${esc(p.name)}"><img src="${esc(p.images[2])}" alt="${esc(p.name)}" loading="lazy">${icon('eye', 30)}</a>`).join('')}</div></section>` : ''}
        <section class="section">${secHead('Questions? We’ve got answers', 'Quick answers about ordering, payment and delivery', '#/faq', 'All FAQs')}
          <div class="faq faqgrid ${rv('')}"><div>${faqHTML(FAQS.slice(0, 4))}</div><div>${faqHTML(FAQS.slice(4, 8))}</div></div></section>
        ${newsHTML()}
        ${recentHTML()}
      </div>`;
  }
  function newsHTML() {
    return `<section class="news ${rv('pop')}"><div><h2>Get new designs &amp; offers first</h2><p>Join our list and be the first to hear about new arrivals, bridal drops and special prices${S.settings.couponCode ? ` — plus a ${esc(S.settings.couponPercent)}% welcome code` : ''}.</p></div>
      <form id="nf" novalidate><input type="email" name="email" placeholder="Your email address" aria-label="Email address" required><button class="btn gold" type="submit">Subscribe</button></form></section>`;
  }
  function recentHTML(excl) {
    const list = recent.map(prodById).filter((p) => p && p.id !== excl).slice(0, 8); if (!list.length) return '';
    return `<section class="section">${secHead('Recently viewed', 'Pick up where you left off')}${scroller(list, 'recenttrack')}</section>`;
  }

  function pageShop(q) {
    const slug = q.get('cat') || ''; const cat = catBySlug(slug); const offer = q.get('offer') === '1';
    const term = (q.get('q') || '').toLowerCase().trim(); const min = Number(q.get('min')) || 0; const max = Number(q.get('max')) || 0;
    const stock = q.get('stock') === '1'; const sort = q.get('sort') || 'featured'; const color = q.get('color') || '';
    let list = S.products.filter((p) => {
      if (cat && p.categoryId !== cat.id) return false;
      if (offer && !(p.oldPrice > p.price)) return false;
      if (min && p.price < min) return false; if (max && p.price > max) return false;
      if (stock && p.stock < 1) return false;
      if (color && !p.colors.includes(color)) return false;
      if (term) { const c = catById(p.categoryId); const hay = (p.name + ' ' + (c ? c.name : '') + ' ' + p.colors.join(' ') + ' ' + p.description).toLowerCase(); if (!term.split(/\s+/).every((w) => hay.includes(w))) return false; }
      return true;
    });
    const sorts = { new: (a, b) => b.createdAt - a.createdAt, 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name), discount: (a, b) => pct(b) - pct(a) };
    if (offer && sort === 'featured') list.sort(sorts.discount); else if (sorts[sort]) list.sort(sorts[sort]);
    const counts = {}; S.products.forEach((p) => { counts[p.categoryId] = (counts[p.categoryId] || 0) + 1; });
    const base = offer ? '#/shop?offer=1' : '#/shop';
    const qs = (o) => { const m = new URLSearchParams(q); Object.entries(o).forEach(([k, v]) => (v === '' || v == null ? m.delete(k) : m.set(k, v))); const s = m.toString(); return '#/shop' + (s ? '?' + s : ''); };
    const title = offer ? 'Offers & Deals' : term ? `Results for “${esc(q.get('q'))}”` : cat ? esc(cat.name) : 'All Clutches';
    document.title = `${offer ? 'Offers' : term ? 'Search' : cat ? cat.name : 'All Clutches'} — Clutch Bags Kenya`;
    const allCols = {}; S.products.forEach((p) => p.colors.forEach((c) => { allCols[c] = (allCols[c] || 0) + 1; }));
    const topCols = Object.entries(allCols).sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0]);
    const chips = [cat && ['cat', cat.name], term && ['q', `“${q.get('q')}”`], min && ['min', `Min ${money(min)}`], max && ['max', `Max ${money(max)}`], stock && ['stock', 'In stock'], color && ['color', color], offer && ['offer', 'On offer']].filter(Boolean);
    shopState = { list, shown: 0 };
    const first = list.slice(0, 12); shopState.shown = first.length;
    return `<div class="wrap">
      <div class="crumbs"><a href="#/">Home</a> / <a href="#/shop">Shop</a>${cat ? ` / ${esc(cat.name)}` : ''}</div>
      <h1 class="page-title">${title}</h1>
      ${offer ? `<div class="pagebanner"><div><h2>${icon('flame', 26)} ${esc(S.settings.saleTitle || 'Special offers')}</h2><p>Reduced prices on selected clutches — while stock lasts.</p></div>${Date.parse(S.settings.saleEnds || '') > Date.now() ? `<div class="cd" data-cd="${Date.parse(S.settings.saleEnds)}"><div><b data-u="d">00</b><span>Days</span></div><div><b data-u="h">00</b><span>Hrs</span></div><div><b data-u="m">00</b><span>Min</span></div><div><b data-u="s">00</b><span>Sec</span></div></div>` : ''}</div>` : ''}
      <div class="catpills"><a href="${offer ? '#/offers' : '#/shop'}" class="${!cat ? 'on' : ''}">All</a>${S.categories.map((c) => `<a href="${qs({ cat: c.slug })}" class="${cat && cat.id === c.id ? 'on' : ''}">${esc(c.name)}</a>`).join('')}</div>
      <div class="shop">
        <aside class="filters" id="filters">
          <h4>CATEGORIES</h4>
          <a class="fcat ${!cat ? 'on' : ''}" href="${qs({ cat: '' })}">All clutches <span>${S.products.length}</span></a>
          ${S.categories.map((c) => `<a class="fcat ${cat && cat.id === c.id ? 'on' : ''}" href="${qs({ cat: c.slug })}">${esc(c.name)} <span>${counts[c.id] || 0}</span></a>`).join('')}
          <h4>PRICE (KSH)</h4>
          <div class="prange"><input id="pmin" type="number" min="0" placeholder="Min" value="${min || ''}"><span>–</span><input id="pmax" type="number" min="0" placeholder="Max" value="${max || ''}"></div>
          <h4>COLOUR</h4><div class="colchips">${topCols.map((c) => `<a href="${qs({ color: color === c ? '' : c })}" class="${color === c ? 'on' : ''}"><i style="${dot(c)}"></i>${esc(c)}</a>`).join('')}</div>
          <div style="height:14px"></div><label class="chk"><input type="checkbox" id="pstock" ${stock ? 'checked' : ''}> In stock only</label>
          <label class="chk"><input type="checkbox" id="poffer" ${offer ? 'checked' : ''}> On offer only</label>
          <a class="btn line block" href="${base === '#/shop' ? '#/shop' : '#/shop'}">Clear filters</a>
        </aside>
        <div>
          <div class="toolbar"><div style="display:flex;align-items:center;gap:12px"><button class="btn line sm fbtn" data-act="filters">${icon('filter', 16)} Filters</button> <span id="rescount">${list.length} product${list.length === 1 ? '' : 's'}</span></div>
            <select id="sort" aria-label="Sort">${[['featured', 'Featured'], ['new', 'Newest'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['discount', 'Biggest discount'], ['name', 'Name A–Z']].map((o) => `<option value="${o[0]}" ${sort === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
          ${chips.length ? `<div class="achips">${chips.map((c) => `<a href="${qs({ [c[0]]: '' })}">${esc(c[1])} ${icon('x', 13)}</a>`).join('')}</div>` : ''}
          <div id="shopgrid">${gridHTML(first, 'three')}</div>
          <div class="loadmore" id="lm" ${list.length > first.length ? '' : 'hidden'}><button class="btn line" data-act="more">Load more clutches (${list.length - first.length} left)</button></div>
        </div>
      </div></div>`;
  }

  function pagePDP(id) {
    const p = prodById(id);
    if (!p) return `<div class="wrap"><div class="empty" style="margin-top:50px">Product not found.<br><br><a class="btn sm" href="#/shop">Back to shop</a></div></div>`;
    pushRecent(p.id);
    const c = catById(p.categoryId); const imgs = p.images.length ? p.images : ['img/logo.png']; const sale = pct(p);
    const rel = S.products.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 8);
    document.title = `${p.name} — Clutch Bags Kenya`;
    const stockCls = p.stock < 1 ? 'out' : p.stock <= 5 ? 'low' : 'in'; const stockTxt = p.stock < 1 ? 'Sold out' : p.stock <= 5 ? `Only ${p.stock} left` : 'In stock';
    const specs = Array.isArray(p.specs) ? p.specs : []; const spec = (k) => (specs.find((s) => s[0].toLowerCase().startsWith(k)) || [])[1];
    const KF = [['Material', 'layers', 'material'], ['Size', 'ruler', 'size'], ['Closure', 'lock', 'closure'], ['Strap', 'link', 'strap'], ['Fits', 'pocket', 'fits'], ['Best for', 'sparkles', 'best']].map((k) => [k[0], k[1], spec(k[2])]).filter((k) => k[2]);
    const z = zones(); const url = location.href.split('#')[0] + '#/product/' + p.id;
    pdp = { id: p.id, qty: 1, color: p.colors[0] || '' };
    const share = encodeURIComponent(`${p.name} — ${money(p.price)} at ${S.settings.storeName}`);
    return `<div class="wrap">
      <div class="crumbs"><a href="#/">Home</a> / <a href="#/shop">Shop</a> / ${c ? `<a href="#/shop?cat=${c.slug}">${esc(c.name)}</a> / ` : ''}${esc(p.name)}</div>
      <div class="pdp">
        <div class="pgal">
          <div class="pmain" id="pmain" data-act="lb-open">${imgs.map((s, i) => `<img class="im ${i === 0 ? 'on' : ''}" src="${esc(s)}" alt="${esc(p.name)}">`).join('')}
            ${p.badge ? `<span class="pbadge">${esc(p.badge)}</span>` : ''}${sale ? `<span class="psale" style="top:46px">-${sale}%</span>` : ''}
            ${imgs.length > 1 ? `<button class="gnav l" data-act="gal" data-d="-1" aria-label="Previous photo">${icon('left', 20)}</button><button class="gnav r" data-act="gal" data-d="1" aria-label="Next photo">${icon('right', 20)}</button>` : ''}
            <span class="gzoom">${icon('zoom', 16)} Click to enlarge</span><div class="gbar" id="gbar"></div></div>
          ${imgs.length > 1 ? `<div class="pthumbs" id="pthumbs">${imgs.map((s, i) => `<button data-act="thumb" data-i="${i}" class="${i === 0 ? 'on' : ''}" aria-label="Photo ${i + 1}"><img src="${esc(s)}" alt=""></button>`).join('')}</div>` : ''}
        </div>
        <div class="pinfo">
          <div class="ccat">${c ? `<a href="#/shop?cat=${c.slug}">${esc(c.name)}</a>` : ''}</div>
          <h1>${esc(p.name)}</h1>
          <div class="pr"><b>${money(p.price)}</b>${sale ? `<s>${money(p.oldPrice)}</s><em>-${sale}%</em><span class="save">You save ${money(p.oldPrice - p.price)}</span>` : ''}</div>
          <div class="stock ${stockCls}">${icon(stockCls === 'out' ? 'x' : 'check', 16)} ${stockTxt}</div>
          ${p.stock > 0 ? `<div class="stockbar" title="Stock level"><i style="width:${Math.min(100, Math.max(8, p.stock * 4))}%"></i></div>` : '<div style="height:16px"></div>'}
          <p class="d">${esc(p.description)}</p>
          ${KF.length ? `<div class="keyf">${KF.map((k) => `<div class="kf">${icon(k[1], 20)}<div><small>${k[0]}</small><b>${esc(k[2])}</b></div></div>`).join('')}</div>` : ''}
          ${p.colors.length ? `<div class="opt"><label>Colour: <span id="colname">${esc(p.colors[0])}</span></label><div class="swatches" id="sw">${p.colors.map((x, i) => `<button data-act="color" data-c="${esc(x)}" class="${i === 0 ? 'on' : ''}"><i style="${dot(x)}"></i>${esc(x)}</button>`).join('')}</div></div>` : ''}
          <div class="buyrow"><div class="qty"><button data-act="pq" data-d="-1" aria-label="Less">${icon('minus', 16)}</button><span id="qv">1</span><button data-act="pq" data-d="1" aria-label="More">${icon('plus', 16)}</button></div>
            <button class="btn" data-act="padd" ${p.stock < 1 ? 'disabled' : ''}>${icon('cart', 18)} Add to cart</button>
            <button class="btn line wish ${wish.includes(p.id) ? 'on' : ''}" data-act="wish" data-id="${p.id}" aria-label="Save to wishlist">${icon('heart', 20)}</button></div>
          <div class="buyrow"><button class="btn gold" data-act="buynow" ${p.stock < 1 ? 'disabled' : ''}>Buy it now ${icon('arrow', 18)}</button>
            <a class="btn wa" target="_blank" rel="noopener" href="${waLink(`Hello Clutch Bags Kenya, I'm interested in "${p.name}" (${money(p.price)}).`)}">${icon('whatsapp', 18)} Order on WhatsApp</a></div>
          <div class="delv"><h4>${icon('truck', 18)} Check delivery</h4><select id="dz" aria-label="Delivery area">${z.map((x) => `<option value="${x.fee}">${esc(x.name)}</option>`).join('')}</select><p id="dzmsg"></p></div>
          <div class="trust"><div>${icon('truck', 22)}Free same-day CBD delivery</div><div>${icon('wallet', 22)}M-Pesa or cash on delivery</div><div>${icon('shield', 22)}Checked before dispatch</div></div>
          <div class="share"><span>Share:</span><button data-act="copy" data-text="${esc(url)}" aria-label="Copy link">${icon('copy', 17)}</button>
            <a href="https://wa.me/?text=${share}%20${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Share on WhatsApp">${icon('whatsapp', 17)}</a>
            <a href="https://twitter.com/intent/tweet?text=${share}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Share on X">${icon('xsocial', 15)}</a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Share on Facebook">${icon('facebook', 17)}</a></div>
        </div>
      </div>
      <div class="ptabs"><div class="tabnav" id="ptabnav"><button class="on" data-act="ptab" data-t="desc">Description</button><button data-act="ptab" data-t="spec">Specifications</button><button data-act="ptab" data-t="ship">Delivery &amp; returns</button><button data-act="ptab" data-t="pay">How to pay</button></div><div id="ptab"></div></div>
      ${rel.length ? `<section class="section">${secHead('You may also like', 'More from ' + esc(c ? c.name : 'the collection'), c ? '#/shop?cat=' + c.slug : '#/shop')}${scroller(rel, 'reltrack')}</section>` : ''}
      ${recentHTML(p.id)}
    </div>
    <div class="stickybuy"><b>${money(p.price)}</b><button class="btn" data-act="padd" ${p.stock < 1 ? 'disabled' : ''}>${icon('cart', 18)} Add to cart</button></div>`;
  }
  function ptabHTML(k, p) {
    const s = S.settings; const z = zones();
    if (k === 'spec') { const sp = Array.isArray(p.specs) ? p.specs : []; return `<div class="tabpane"><h3>Specifications</h3>${sp.length ? `<table class="spectable">${sp.map((r) => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}<tr><th>Colours</th><td>${esc(p.colors.join(', '))}</td></tr></table>` : '<p>Message us on WhatsApp for full size and material details of this clutch.</p>'}</div>`; }
    if (k === 'ship') return `<div class="tabpane"><h3>Delivery</h3><ul>${z.map((x) => `<li><b>${esc(x.name)}</b> — ${x.fee ? money(x.fee) : 'FREE'}</li>`).join('')}</ul><p>We confirm every order by phone or WhatsApp before dispatch. Countrywide orders go by courier or bus parcel and we share the parcel details with you.</p><h3 style="margin-top:20px">Returns &amp; exchanges</h3><p>If your clutch arrives faulty or different from what you ordered, contact us as soon as it arrives with a photo and your order number and we will arrange an exchange or refund. <a href="#/delivery" style="color:var(--g700);font-weight:600">Read the full policy</a>.</p></div>`;
    if (k === 'pay') return `<div class="tabpane"><h3>How to pay</h3><ul><li><b>M-Pesa:</b> place your order, then pay to our ${esc(s.mpesaType)} <b>${esc(s.mpesaNumber)}</b> (${esc(s.mpesaName)}) using your order number as the reference, and send us the confirmation message.</li><li><b>Cash on delivery:</b> pay when your clutch arrives.</li></ul><p>Need help? <a href="${waLink()}" target="_blank" rel="noopener" style="color:var(--g700);font-weight:600">Chat with us on WhatsApp</a>.</p></div>`;
    return `<div class="tabpane"><h3>About this clutch</h3><p>${esc(p.description)}</p><ul><li>Available colours: ${esc(p.colors.join(', ') || '—')}</li><li>Pay with M-Pesa or cash on delivery</li><li>Free same-day delivery within Nairobi CBD</li></ul></div>`;
  }

  function pageCart() {
    const lines = cartLines(); document.title = 'Cart — Clutch Bags Kenya';
    if (!lines.length) return `<div class="wrap"><h1 class="page-title" style="margin-top:30px">Your cart</h1><div class="empty">${icon('cart', 44)}<br><br>Your cart is empty.<br><br><a class="btn" href="#/shop">Start shopping</a></div></div>`;
    return `<div class="wrap"><h1 class="page-title" style="margin-top:30px">Your cart</h1>
      <div class="cartwrap"><div class="panel">${lines.map((i, n) => `<div class="cline"><a href="#/product/${i.p.id}"><img src="${esc(i.p.images[0] || 'img/logo.png')}" alt=""></a>
        <div class="n"><b>${esc(i.p.name)}</b><span>${esc(i.color)}${i.color ? ' · ' : ''}${money(i.p.price)}</span></div>
        <div class="qty"><button data-q="${n}" data-d="-1" aria-label="Less">${icon('minus', 15)}</button><span>${i.qty}</span><button data-q="${n}" data-d="1" aria-label="More">${icon('plus', 15)}</button></div>
        <div class="tot">${money(i.p.price * i.qty)}</div><button class="rm" data-rm="${n}" aria-label="Remove">${icon('trash', 18)}</button></div>`).join('')}</div>
        <div class="panel"><h3>Order summary</h3><div class="sumrow"><span>Subtotal</span><span>${money(cartSub())}</span></div><div class="sumrow"><span>Delivery</span><span>At checkout</span></div>
          ${S.settings.couponCode ? `<div class="freebar" style="margin:8px 0">${icon('percent', 16)} Have a promo code? Enter it at checkout.</div>` : ''}
          <div class="sumrow t"><span>Total</span><span>${money(cartSub())}</span></div><br><a class="btn block" href="#/checkout">Checkout ${icon('arrow', 18)}</a><br><a class="btn line block" href="#/shop">Continue shopping</a></div></div></div>`;
  }

  function pageCheckout() {
    const lines = cartLines(); document.title = 'Checkout — Clutch Bags Kenya';
    if (!lines.length) return `<div class="wrap"><div class="empty" style="margin-top:40px">Your cart is empty.<br><br><a class="btn" href="#/shop">Start shopping</a></div></div>`;
    const z = zones(); const s = S.settings;
    return `<div class="wrap"><h1 class="page-title" style="margin-top:30px">Checkout</h1>
      <form id="co" class="cartwrap" novalidate>
        <div>
          <div class="panel"><h3>Delivery details</h3><div id="coerr"></div>
            <div class="form2">
              <div class="fld"><label>Full name *</label><input class="inp" name="name" autocomplete="name" required></div>
              <div class="fld"><label>Phone (M-Pesa) *</label><input class="inp" name="phone" inputmode="tel" autocomplete="tel" placeholder="07XX XXX XXX" required></div>
              <div class="fld"><label>Delivery area *</label><select class="inp" name="zone" id="zone">${z.map((x) => `<option value="${esc(x.name)}">${esc(x.name)} — ${x.fee ? money(x.fee) : 'FREE'}</option>`).join('')}</select></div>
              <div class="fld"><label>Town / estate</label><input class="inp" name="town"></div>
              <div class="fld full"><label>Address / landmark / pick-up point</label><textarea class="inp" name="address"></textarea></div>
              <div class="fld full"><label>Order notes (optional)</label><textarea class="inp" name="notes" placeholder="Colour preference, delivery time..."></textarea></div>
            </div></div>
          <div class="panel" style="margin-top:20px"><h3>Payment</h3>
            <label class="pay on"><input type="radio" name="payment" value="mpesa" checked><div><b><span class="mp">M-PESA</span> Pay with M-Pesa</b><small>You’ll get our ${esc(s.mpesaType)} and a reference right after placing your order.</small></div></label>
            <label class="pay"><input type="radio" name="payment" value="cod"><div><b>${icon('wallet', 18)} Cash on delivery</b><small>Pay when your clutch arrives.</small></div></label>
          </div>
        </div>
        <div class="panel" style="position:sticky;top:160px"><h3>Your order</h3>
          ${lines.map((i) => `<div class="sumitem"><img src="${esc(i.p.images[0] || 'img/logo.png')}" alt=""><div><b>${esc(i.p.name)}</b><span>${esc(i.color)} · Qty ${i.qty}</span></div><em>${money(i.p.price * i.qty)}</em></div>`).join('')}
          ${s.couponCode ? `<div class="coupon"><input class="inp" id="cpn" placeholder="Promo code" aria-label="Promo code"><button type="button" class="btn line" id="cpnbtn">Apply</button></div><div class="cmsg" id="cpnmsg"></div>` : ''}
          <div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px"><div class="sumrow"><span>Subtotal</span><span>${money(cartSub())}</span></div>
          <div class="sumrow disc" id="discrow" hidden><span>Discount</span><span id="disc"></span></div>
          <div class="sumrow"><span>Delivery</span><span id="dfee"></span></div><div class="sumrow t"><span>Total</span><span id="gtot"></span></div></div>
          <br><button class="btn block" id="place" type="submit">Place order</button>
          <p style="font-size:12.5px;color:var(--mut);text-align:center;margin-top:12px">${icon('lock', 13)} We only use your details to deliver your order.</p></div>
      </form></div>`;
  }

  function pageOrder() {
    const o = ls.get('cbk_last', null); document.title = 'Order placed — Clutch Bags Kenya';
    if (!o) return `<div class="wrap"><div class="empty" style="margin-top:40px">No recent order.<br><br><a class="btn" href="#/shop">Continue shopping</a></div></div>`;
    const s = S.settings;
    const msg = `Hello Clutch Bags Kenya, I just placed order ${o.number} (${money(o.total)}). Name: ${o.name}.${o.payment === 'mpesa' ? ' I will pay via M-Pesa.' : ''}`;
    return `<div class="wrap"><div class="success"><div class="tick">${icon('check', 40)}</div><h1>Thank you, ${esc(o.name.split(' ')[0])}!</h1>
      <p style="color:var(--mut)">Your order has been received. We’ll call or WhatsApp you shortly to confirm delivery.</p><div class="ref">Order ${esc(o.number)} · ${money(o.total)}</div>
      ${o.payment === 'mpesa' ? `<div class="panel"><h3>Pay with M-Pesa</h3><ol style="padding-left:20px;line-height:1.9;color:#46524b"><li>Open <b>M-Pesa</b> on your phone and choose <b>Lipa na M-Pesa</b>.</li><li>Select <b>${esc(s.mpesaType)}</b> and enter <b>${esc(s.mpesaNumber)}</b> (${esc(s.mpesaName)}).</li><li>Enter the amount <b>${money(o.total)}</b>${/paybill/i.test(s.mpesaType) ? ` and account number <b>${esc(o.number)}</b>` : ''}, then your PIN.</li><li>Send us the M-Pesa confirmation message on WhatsApp.</li></ol></div>` : `<div class="panel"><h3>Cash on delivery</h3><p style="color:#46524b">Please have <b>${money(o.total)}</b> ready when your order arrives.</p></div>`}
      <a class="btn wa block" target="_blank" rel="noopener" href="${waLink(msg)}">${icon('whatsapp', 18)} Confirm on WhatsApp</a><br><a class="btn line block" href="#/track">Track this order</a><br><a class="btn line block" href="#/shop">Continue shopping</a></div></div>`;
  }

  function pageWishlist() {
    document.title = 'Wishlist — Clutch Bags Kenya';
    const list = wish.map(prodById).filter(Boolean);
    return `<div class="wrap"><h1 class="page-title" style="margin-top:30px">Your wishlist</h1>${list.length ? gridHTML(list) : `<div class="empty">${icon('heart', 44)}<br><br>You haven’t saved anything yet. Tap the heart on any clutch to keep it here.<br><br><a class="btn" href="#/shop">Browse clutches</a></div>`}</div>`;
  }

  function pageContact() {
    const s = S.settings; document.title = 'Contact us — Clutch Bags Kenya';
    const it = (ic, t, v, href) => `<div class="it"><div class="ico">${icon(ic, 20)}</div><div><b>${t}</b>${href ? `<a href="${href}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(v)}</a>` : `<span>${esc(v)}</span>`}</div></div>`;
    return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / Contact</div><h1 class="page-title">Contact us</h1>
      <div class="contactgrid"><div class="panel cinfo">${it('phone', 'Call us', s.phone, telLink())}${it('whatsapp', 'WhatsApp', '+' + s.whatsapp, waLink())}${it('mail', 'Email', s.email, 'mailto:' + s.email)}${it('pin', 'Find us', s.address)}${it('clock', 'Opening hours', s.hours)}${s.twitter ? it('xsocial', 'X (Twitter)', '@' + s.twitter, 'https://x.com/' + s.twitter) : ''}${s.instagram ? it('instagram', 'Instagram', '@' + s.instagram, 'https://instagram.com/' + s.instagram) : ''}</div>
      <form class="panel" id="cf"><h3>Send us a message</h3><div id="cferr"></div><div class="form2"><div class="fld"><label>Your name *</label><input class="inp" name="name" required></div><div class="fld"><label>Phone</label><input class="inp" name="phone"></div><div class="fld full"><label>Email</label><input class="inp" name="email" type="email"></div><div class="fld full"><label>Message *</label><textarea class="inp" name="message" style="min-height:140px" required></textarea></div></div><br><button class="btn" type="submit">Send message ${icon('arrow', 18)}</button></form></div></div>`;
  }

  function pageAbout() {
    document.title = 'About us — Clutch Bags Kenya'; const s = S.settings;
    const vals = [['sparkles', 'Curated designs', 'Evening, envelope, box, bridal, leather and African print clutches chosen to be worn and noticed.'], ['shield', 'Carefully checked', 'Every clutch is checked before it leaves us so it reaches you looking its best.'], ['wallet', 'Easy payment', 'Pay with M-Pesa or cash on delivery — whichever is easiest for you.'], ['truck', 'Delivered to you', 'Free same-day delivery in Nairobi CBD and countrywide delivery by courier and bus parcel.'], ['whatsapp', 'Friendly help', 'Chat with us on WhatsApp for advice on colours, gifts, bridesmaid sets and bulk orders.'], ['gift', 'Gift-ready', 'Looking for a present? Ask us and we will help you choose something she will love.']];
    return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / About us</div>
      <div class="pagehero"><h1>About ${esc(s.storeName)}</h1><p>${esc(s.tagline)} We help women across Kenya find the perfect clutch for weddings, nights out, the office and everyday life.</p></div>
      <div class="valgrid">${vals.map((v, i) => `<div class="wcard ${rv('pop', i * 0.07)}" style="text-align:left"><div class="ico" style="margin:0 0 14px">${icon(v[0], 26)}</div><b style="font-size:17px">${v[1]}</b><span>${v[2]}</span></div>`).join('')}</div>
      <div class="news" style="margin-top:20px"><div><h2>Let’s find your perfect clutch</h2><p>Browse the full collection or message us — we’re happy to help.</p></div><div style="display:flex;gap:12px;flex-wrap:wrap;position:relative;z-index:1"><a class="btn gold" href="#/shop">Shop all clutches</a><a class="btn light" href="#/contact">Contact us</a></div></div></div>`;
  }
  function pageDelivery() {
    document.title = 'Delivery & returns — Clutch Bags Kenya'; const s = S.settings; const z = zones();
    return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / Delivery &amp; returns</div>
      <div class="pagehero"><h1>Delivery &amp; Returns</h1><p>Fast, simple delivery across Kenya and easy payment with M-Pesa.</p></div>
      <div class="prose"><h2>${icon('truck', 22)} Delivery areas &amp; fees</h2>
        <table class="spectable">${z.map((x) => `<tr><th>${esc(x.name)}</th><td>${x.fee ? money(x.fee) : '<b style="color:var(--g700)">FREE</b>'}</td></tr>`).join('')}</table>
        <p style="margin-top:12px">We confirm each order by phone or WhatsApp before dispatch. For countrywide orders we send by courier or bus parcel and share the parcel details with you.</p>
        <h2>${icon('wallet', 22)} Payment</h2><ul><li><b>M-Pesa:</b> pay to our ${esc(s.mpesaType)} <b>${esc(s.mpesaNumber)}</b> (${esc(s.mpesaName)}) and send us the confirmation message.</li><li><b>Cash on delivery:</b> pay when your order arrives.</li></ul>
        <h2>${icon('rotate', 22)} Returns &amp; exchanges</h2><p>If your clutch arrives faulty or different from what you ordered, contact us as soon as it arrives with a photo and your order number. We will arrange an exchange or refund for faulty or incorrect items. Please keep the clutch unused and in its original condition.</p>
        <h2>${icon('help', 22)} Need help?</h2><p>Call <a href="${telLink()}" style="color:var(--g700);font-weight:600">${esc(s.phone)}</a>, <a href="${waLink()}" target="_blank" rel="noopener" style="color:var(--g700);font-weight:600">WhatsApp us</a> or visit the <a href="#/faq" style="color:var(--g700);font-weight:600">FAQ page</a>.</p></div></div>`;
  }
  function pageFaq() { document.title = 'FAQs — Clutch Bags Kenya'; return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / FAQs</div><div class="pagehero"><h1>Frequently Asked Questions</h1><p>Quick answers about ordering, payment, delivery and care.</p></div><div class="prose faq">${faqHTML(FAQS)}<div style="text-align:center;margin-top:24px"><p>Still need help?</p><br><a class="btn" href="#/contact">Contact us</a></div></div></div>`; }
  function pageTrack() {
    document.title = 'Track your order — Clutch Bags Kenya'; const last = ls.get('cbk_last', null) || {};
    return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / Track order</div><div class="pagehero"><h1>Track Your Order</h1><p>Enter your order number and the phone number you used at checkout.</p></div>
      <div class="prose"><form class="panel" id="tf" novalidate><div id="terr"></div><div class="form2"><div class="fld"><label>Order number</label><input class="inp" name="number" placeholder="CBK-1001" value="${esc(last.number || '')}" required></div><div class="fld"><label>Phone number</label><input class="inp" name="phone" placeholder="07XX XXX XXX" required></div></div><br><button class="btn" type="submit">${icon('search', 18)} Track order</button></form><div id="tres"></div></div></div>`;
  }
  function pagePrivacy() { document.title = 'Privacy — Clutch Bags Kenya'; return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / Privacy</div><div class="pagehero"><h1>Privacy Policy</h1><p>How we handle your information.</p></div><div class="prose"><h2>What we collect</h2><p>When you order or contact us we collect your name, phone number, delivery address, email (optional) and order details so we can deliver your clutch and reply to you.</p><h2>How we use it</h2><p>Only to process and deliver your order, confirm payment, answer your questions and, if you subscribe, share new designs and offers. We do not sell your information.</p><h2>Your choices</h2><p>You can ask us to update or delete your details at any time through the <a href="#/contact" style="color:var(--g700);font-weight:600">contact page</a>.</p></div></div>`; }
  function pageTerms() { document.title = 'Terms — Clutch Bags Kenya'; return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / Terms</div><div class="pagehero"><h1>Terms of Service</h1><p>Simple terms for shopping with us.</p></div><div class="prose"><h2>Orders</h2><p>An order is confirmed once we contact you and, for M-Pesa orders, receive your payment. Items are subject to availability.</p><h2>Prices</h2><p>Prices are shown in Kenya Shillings (KSh). Delivery fees are shown at checkout.</p><h2>Colours</h2><p>Screen colours may differ slightly from the actual product.</p><h2>Returns</h2><p>See our <a href="#/delivery" style="color:var(--g700);font-weight:600">Delivery &amp; returns</a> page.</p></div></div>`; }
  function pageNotFound() { document.title = 'Page not found — Clutch Bags Kenya'; return `<div class="wrap"><div class="empty" style="margin-top:50px">${icon('search', 44)}<br><br><b style="font-size:20px">We couldn’t find that page</b><br><br><a class="btn" href="#/">Go home</a> &nbsp; <a class="btn line" href="#/shop">Shop clutches</a></div></div>`; }

  /* --------------------------------------------------------- page init */
  function initReveal() {
    const els = $$('.rv:not(.in)'); const count = (el) => { const to = +el.dataset.count || 0; let n = 0; const step = Math.max(1, Math.ceil(to / 40)); const t = setInterval(() => { n = Math.min(to, n + step); el.textContent = n; if (n >= to) clearInterval(t); }, 28); };
    const pending = () => $$('[data-count]').filter((e) => !e._c);
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); pending().forEach((e) => { e._c = 1; e.textContent = e.dataset.count; }); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); $$('[data-count]', en.target).forEach((e) => { if (!e._c) { e._c = 1; count(e); } }); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((e) => io.observe(e));
  }
  function startCountdowns() {
    const tick = () => $$('[data-cd]').forEach((el) => { let ms = Math.max(0, +el.dataset.cd - Date.now()); const d = Math.floor(ms / 864e5); ms -= d * 864e5; const h = Math.floor(ms / 36e5); ms -= h * 36e5; const m = Math.floor(ms / 6e4); const s = Math.floor((ms - m * 6e4) / 1e3); const set = (u, v) => { const n = $(`[data-u=${u}]`, el); if (n) n.textContent = String(v).padStart(2, '0'); }; set('d', d); set('h', h); set('m', m); set('s', s); });
    if ($('[data-cd]')) { tick(); timers.push(setInterval(tick, 1000)); }
  }

  let hero = null;
  function initHero() {
    const el = $('#hero'); if (!el) return; const slides = $$('.slide', el); const dots = $$('.dots button', el); const prog = $('#prog'); const cnt = $('#hcount');
    let i = 0, t; hero = { go: null };
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('on', k === i)); dots.forEach((d, k) => d.classList.toggle('on', k === i));
      el.classList.toggle('hasdark', slides[i].dataset.dark === '1'); if (cnt) cnt.textContent = `${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
      prog.style.transition = 'none'; prog.style.width = '0'; void prog.offsetWidth; prog.style.transition = `width ${HERO_MS}ms linear`; prog.style.width = '100%';
      clearTimeout(t); t = setTimeout(() => { if (!document.body.contains(el)) return; if (document.hidden || el.matches(':hover')) { go(i); } else go(i + 1); }, HERO_MS);
    };
    hero.go = go; hero.cur = () => i;
    if (slides.length > 1) go(0); else prog.remove();
    let x0 = null; el.addEventListener('pointerdown', (e) => { x0 = e.clientX; }); el.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 50) go(i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    timers.push({ stop: () => clearTimeout(t) }); // cleaned on route change
  }

  function initShop() {
    const go = (k, v) => { const m = new URLSearchParams((location.hash.split('?')[1]) || ''); v ? m.set(k, v) : m.delete(k); const s = m.toString(); location.hash = '#/shop' + (s ? '?' + s : ''); };
    $('#sort').addEventListener('change', (e) => go('sort', e.target.value === 'featured' ? '' : e.target.value));
    $('#pmin').addEventListener('change', (e) => go('min', e.target.value)); $('#pmax').addEventListener('change', (e) => go('max', e.target.value));
    $('#pstock').addEventListener('change', (e) => go('stock', e.target.checked ? '1' : ''));
    $('#poffer').addEventListener('change', (e) => go('offer', e.target.checked ? '1' : ''));
  }

  function gallery() {
    const main = $('#pmain'); if (!main) return; const imgs = $$('.im', main); const thumbs = $$('#pthumbs button'); const bar = $('#gbar'); let i = 0, t;
    main._go = (n) => {
      i = (n + imgs.length) % imgs.length; imgs.forEach((im, k) => im.classList.toggle('on', k === i)); thumbs.forEach((b, k) => b.classList.toggle('on', k === i)); main._i = i;
      if (imgs.length < 2) return; bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = `width ${SLIDE_MS}ms linear`; bar.style.width = '100%';
      clearTimeout(t); const tick = () => { if (!document.body.contains(main)) return; if (document.hidden || main.matches(':hover')) { t = setTimeout(tick, 800); return; } main._go(i + 1); }; t = setTimeout(tick, SLIDE_MS);
    };
    main._go(0); timers.push({ stop: () => clearTimeout(t) });
    // hover zoom (mouse only)
    main.addEventListener('mousemove', (e) => { if (e.pointerType === 'touch') return; const r = main.getBoundingClientRect(); main.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%'); main.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%'); main.classList.add('zoom'); });
    main.addEventListener('mouseleave', () => main.classList.remove('zoom'));
    const dz = $('#dz'); const upd = () => { const f = +dz.value; const name = dz.options[dz.selectedIndex].text; $('#dzmsg').innerHTML = f === 0 ? `${icon('check', 16)} Free delivery — same day for ${esc(name.replace(/\(.*\)/, '').trim())} orders` : `${icon('truck', 16)} Delivery fee ${money(f)}`; };
    dz.addEventListener('change', upd); upd();
    const p = prodById(pdp.id); $('#ptab').innerHTML = ptabHTML('desc', p);
  }

  function initCheckout() {
    const z = zones(); const sub = cartSub(); const s = S.settings; let disc = 0, code = '';
    const upd = () => { const zone = z.find((x) => x.name === $('#zone').value) || z[0]; const fee = zone ? zone.fee : 0; $('#dfee').textContent = fee ? money(fee) : 'FREE'; $('#gtot').textContent = money(sub - disc + fee); $('#discrow').hidden = !disc; if (disc) $('#disc').textContent = '− ' + money(disc); };
    const apply = (c, quiet) => {
      const m = $('#cpnmsg'); const cc = String(s.couponCode || '').trim().toUpperCase(); if (!m) return;
      if (c && cc && c.trim().toUpperCase() === cc) { code = cc; disc = Math.round(sub * (Number(s.couponPercent) || 0) / 100); m.className = 'cmsg ok'; m.textContent = `Code ${cc} applied — you save ${money(disc)}!`; ls.set('cbk_coupon', cc); }
      else { code = ''; disc = 0; m.className = 'cmsg bad'; m.textContent = quiet ? '' : 'That promo code is not valid.'; }
      upd();
    };
    $('#zone').addEventListener('change', upd); upd();
    const cb = $('#cpnbtn'); if (cb) { cb.addEventListener('click', () => apply($('#cpn').value)); const saved = ls.get('cbk_coupon', ''); if (saved) { $('#cpn').value = saved; apply(saved, true); } }
    $$('.pay input').forEach((r) => r.addEventListener('change', () => $$('.pay').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked))));
    $('#co').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = new FormData(e.target); const btn = $('#place'); const err = $('#coerr'); err.innerHTML = '';
      const body = { name: f.get('name'), phone: f.get('phone'), zone: f.get('zone'), town: f.get('town'), address: f.get('address'), notes: f.get('notes'), payment: f.get('payment'), coupon: code, items: cart.map((i) => ({ id: i.id, color: i.color, qty: i.qty })) };
      btn.disabled = true; btn.textContent = 'Placing order…';
      try {
        const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not place order');
        ls.set('cbk_last', { number: d.number, total: d.total, name: body.name, payment: body.payment, phone: body.phone });
        cart = []; ls.set('cbk_cart', cart); await loadStore(); applyStock(); updateBadges(); location.hash = '#/order';
      } catch (ex) { err.innerHTML = `<div class="err">${esc(ex.message)}</div>`; btn.disabled = false; btn.textContent = 'Place order'; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  }

  function initContact() {
    $('#cf').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const err = $('#cferr');
      try { const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); e.target.reset(); err.innerHTML = '<div class="err" style="background:var(--g100);color:var(--g800)">Thanks! We’ve received your message and will reply soon.</div>'; }
      catch (ex) { err.innerHTML = `<div class="err">${esc(ex.message || 'Could not send')}</div>`; }
    });
  }
  function initNews() {
    const f = $('#nf'); if (!f) return;
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const em = f.email.value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { f.email.focus(); toast('Please enter a valid email'); return; }
      try { await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Newsletter signup', email: em, message: 'Please add me to your new designs & offers list.' }) }); } catch (x) { /* ignore */ }
      f.outerHTML = `<div class="ok">${icon('check', 18)} Thank you! You’re on the list${S.settings.couponCode ? ` — use code <b>${esc(S.settings.couponCode)}</b> at checkout.` : '.'}</div>`;
    });
  }
  function initTrack() {
    const STEPS = [['pending', 'Order received', 'check'], ['confirmed', 'Confirmed', 'shield'], ['dispatched', 'On the way', 'truck'], ['delivered', 'Delivered', 'gift']];
    $('#tf').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); $('#terr').innerHTML = ''; $('#tres').innerHTML = '';
      try {
        const r = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); const d = await r.json(); if (!r.ok) throw new Error(d.error);
        const idx = STEPS.findIndex((s) => s[0] === d.status);
        $('#tres').innerHTML = `<div class="panel" style="margin-top:20px"><h3>Order ${esc(d.number)} · ${money(d.total)}</h3>${d.status === 'cancelled' ? '<div class="err">This order was cancelled. Contact us if you need help.</div>' : `<div class="timeline">${STEPS.map((s, k) => `<div class="tl ${k <= idx ? 'done' : ''}"><div class="d">${icon(s[2], 22)}</div><b>${s[1]}</b></div>`).join('')}</div>`}
          <p style="color:var(--mut);font-size:14px">${d.items.map((i) => `${i.qty} × ${esc(i.name)}`).join(' • ')}<br>Delivery area: ${esc(d.zone)} · Payment: ${d.paid ? '<b style="color:var(--g700)">Received</b>' : 'Pending'}</p></div>`;
      } catch (ex) { $('#terr').innerHTML = `<div class="err">${esc(ex.message)}</div>`; }
    });
  }

  /* ----------------------------------------------------------- actions */
  function onClick(e) {
    // cart quantity / remove buttons (drawer + cart page)
    const q = e.target.closest('[data-q]'); const r = e.target.closest('[data-rm]');
    if (q || r) {
      const l = cartLines()[+(q ? q.dataset.q : r.dataset.rm)]; if (!l) return; const it = cart.find((i) => i.id === l.id && i.color === l.color);
      if (q) { it.qty += +q.dataset.d; if (it.qty < 1) cart.splice(cart.indexOf(it), 1); else if (it.qty > l.p.stock) { it.qty = l.p.stock; toast('Maximum stock reached'); } }
      else cart = cart.filter((i) => i !== it);
      saveCart(); if (location.hash.startsWith('#/cart')) render(); return;
    }
    const el = e.target.closest('[data-act]'); if (!el) return; const act = el.dataset.act; const id = el.dataset.id;
    switch (act) {
      case 'add': { if (addToCart(+id)) { toast('Added to cart'); el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 1200); openCartDrawer(); } break; }
      case 'quick': e.preventDefault(); openQuick(+id); break;
      case 'wish': e.preventDefault(); toggleWish(id); break;
      case 'cart-open': openCartDrawer(); break;
      case 'menu-open': renderMenuDrawer(); $('#menud').classList.add('open'); openOverlay(true); break;
      case 'close-all': closeAll(); break;
      case 'scroll': { const t = $(el.dataset.target); if (t) t.scrollBy({ left: +el.dataset.dir * t.clientWidth * 0.85, behavior: 'smooth' }); break; }
      case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'closebub': $('#wabub').classList.remove('show'); ls.set('cbk_bub', 1); break;
      case 'filters': $('#filters').classList.toggle('open'); break;
      case 'hero': hero && hero.go(hero.cur() + +el.dataset.d); break;
      case 'hero-go': hero && hero.go(+el.dataset.i); break;
      case 'tab-home': { $$('#hometabs button').forEach((b) => b.classList.toggle('on', b === el)); const k = el.dataset.k; const l = k === 'new' ? [...S.products].sort((a, b) => b.createdAt - a.createdAt) : k === 'offer' ? onOffer() : S.products.filter((p) => p.featured); const g = $('#tabgrid'); g.innerHTML = `<div class="swap">${gridHTML(l.slice(0, 8))}</div>`; startSliders(g); break; }
      case 'more': { const st = shopState; const next = st.list.slice(st.shown, st.shown + 12); st.shown += next.length; const g = $('#shopgrid .grid'); g.insertAdjacentHTML('beforeend', next.map(cardHTML).join('')); startSliders(g); if (st.shown >= st.list.length) $('#lm').hidden = true; else el.textContent = `Load more clutches (${st.list.length - st.shown} left)`; break; }
      case 'copy': { const t = el.dataset.text; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copied'), () => { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (x) { toast(t); } ta.remove(); }); break; }
      case 'gal': e.stopPropagation(); $('#pmain')._go(($('#pmain')._i || 0) + +el.dataset.d); break;
      case 'thumb': $('#pmain')._go(+el.dataset.i); break;
      case 'lb-open': { if (e.target.closest('.gnav')) break; const main = $('#pmain'); openLightbox($$('.im', main).map((x) => x.getAttribute('src')), main._i || 0); break; }
      case 'lb': { const b = $('#lbx'); b._i = (b._i + +el.dataset.d + b._s.length) % b._s.length; b._draw(); break; }
      case 'color': { pdp.color = el.dataset.c; $$('#sw button').forEach((b) => b.classList.toggle('on', b === el)); $('#colname').textContent = pdp.color; break; }
      case 'pq': { const p = prodById(pdp.id); pdp.qty = Math.min(Math.max(p.stock, 1), Math.max(1, pdp.qty + +el.dataset.d)); $('#qv').textContent = pdp.qty; break; }
      case 'padd': if (addToCart(pdp.id, pdp.color, pdp.qty)) { toast('Added to cart'); openCartDrawer(); } break;
      case 'buynow': if (addToCart(pdp.id, pdp.color, pdp.qty)) location.hash = '#/checkout'; break;
      case 'ptab': { $$('#ptabnav button').forEach((b) => b.classList.toggle('on', b === el)); $('#ptab').innerHTML = ptabHTML(el.dataset.t, prodById(pdp.id)); break; }
      case 'qv-color': { qvs.color = el.dataset.c; $$('.qvg .swatches button').forEach((b) => b.classList.toggle('on', b === el)); $('#qvcol').textContent = qvs.color; break; }
      case 'qv-qty': { const p = prodById(qvs.id); qvs.qty = Math.min(Math.max(p.stock, 1), Math.max(1, qvs.qty + +el.dataset.d)); $('#qvq').textContent = qvs.qty; break; }
      case 'qv-add': if (addToCart(qvs.id, qvs.color, qvs.qty)) { closeAll(); toast('Added to cart'); openCartDrawer(); } break;
      case 'welcome-copy': { const c = S.settings.couponCode; ls.set('cbk_coupon', c); (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => toast('Code copied — applied at checkout'), () => toast('Code ' + c + ' saved for checkout')); break; }
      case 'welcome-shop': ls.set('cbk_coupon', S.settings.couponCode); closeAll(); location.hash = '#/shop'; break;
      default: break;
    }
  }

  /* ----------------------------------------------------------- routing */
  function render() {
    const hash = location.hash || '#/'; const [path, qstr] = hash.slice(1).split('?'); const q = new URLSearchParams(qstr || '');
    const parts = path.split('/').filter(Boolean); const page = parts[0] || 'home';
    document.title = 'Clutch Bags Kenya — Statement Clutch Bags & Handbags in Nairobi';
    timers.forEach((t) => { if (t && t.stop) t.stop(); else { clearTimeout(t); clearInterval(t); } }); timers = []; hero = null;
    closeAll();
    let html = '';
    if (page === 'home') html = pageHome();
    else if (page === 'shop') html = pageShop(q);
    else if (page === 'offers') { q.set('offer', '1'); html = pageShop(q); }
    else if (page === 'product') html = pagePDP(parts[1]);
    else if (page === 'cart') html = pageCart();
    else if (page === 'checkout') html = pageCheckout();
    else if (page === 'order') html = pageOrder();
    else if (page === 'wishlist') html = pageWishlist();
    else if (page === 'contact') html = pageContact();
    else if (page === 'about') html = pageAbout();
    else if (page === 'delivery') html = pageDelivery();
    else if (page === 'faq') html = pageFaq();
    else if (page === 'track') html = pageTrack();
    else if (page === 'privacy') html = pagePrivacy();
    else if (page === 'terms') html = pageTerms();
    else html = pageNotFound();
    $('#main').innerHTML = html;
    renderHeader();
    if (page === 'home') { initHero(); initNews(); }
    if (page === 'shop' || page === 'offers') initShop();
    if (page === 'product') gallery();
    if (page === 'checkout' && $('#co')) initCheckout();
    if (page === 'contact') initContact();
    if (page === 'track') initTrack();
    startSliders($('#main')); initReveal(); startCountdowns();
    if (path !== lastPath) window.scrollTo(0, 0); lastPath = path;
  }

  /* Free-to-use stock photos (Shopify Burst, free for commercial use). Used only where the colour
     matches and the photo actually loads (needs internet); otherwise the drawn picture stays. */
  const STOCK = { red: ['bright-red-purse-with-gold', 'red-purse-with-gold-chain', 'red-handbag-with-gold-detail'], pink: ['pink-purse-with-tassel', 'light-pink-purse', 'pale-pink-sachel', 'over-the-shoulder-pink-purse'], tan: ['light-brown-clutch', 'brown-clutch-gently-held'], brown: ['light-brown-clutch', 'brown-purse-with-black-detail', 'brown-purse-with-shoulder-strap', 'leather-handbag-on-bed'], black: ['black-over-the-shoulder-bag', 'black-bag-over-the-shoulder', 'woman-holding-black-fashion-bag'], yellow: ['lemon-purse'], blue: ['modern-blue-handbag'] };
  const GROUP = { 'Ruby Red': 'red', Red: 'red', Burgundy: 'red', 'Maasai Red': 'red', 'Blush Pink': 'pink', Pink: 'pink', 'Rose Gold': 'pink', Fuchsia: 'pink', Nude: 'pink', Champagne: 'tan', Natural: 'tan', Tan: 'brown', Brown: 'brown', Bronze: 'brown', Black: 'black', Mustard: 'yellow', Yellow: 'yellow', Navy: 'blue', 'Royal Blue': 'blue', 'Cobalt Blue': 'blue', Blue: 'blue' };
  const stockUrl = (slug) => `https://burst.shopifycdn.com/photos/${slug}.jpg?width=900&format=pjpg&exif=0&iptc=0`;
  function testImg(u) { return new Promise((res) => { const i = new Image(); const t = setTimeout(() => res(false), 5000); i.onload = () => { clearTimeout(t); res(true); }; i.onerror = () => { clearTimeout(t); res(false); }; i.src = u; }); }
  async function applyStock() {
    if (!navigator.onLine) return;
    const slugs = [].concat(...Object.values(STOCK)); const ok = {};
    await Promise.all(slugs.map(async (g) => { ok[g] = await testImg(stockUrl(g)); }));
    const BAN = { '#/shop?sort=new': 'fashion-model-looks-at-camera', '#/offers': 'model-in-gold-fashion', '#/shop': 'stylish-skirt-purse', '#/shop?cat=bridal-wedding': 'bride-with-wedding-bouquet', '#/shop?cat=evening-clutches': 'red-purse-with-gold-chain', '#/shop?cat=leather-clutches': 'light-brown-clutch' };
    const bu = (g) => `https://burst.shopifycdn.com/photos/${g}.jpg?width=1600&format=pjpg&exif=0&iptc=0`;
    const bok = {}; await Promise.all(Object.values(BAN).map(async (g) => { bok[g] = await testImg(bu(g)); }));
    S.banners.forEach((b) => { const g = BAN[b.link]; if (g && bok[g] && /^img\/banners\//.test(b.image || '')) b.image = bu(g); });
    S.products.forEach((p) => {
      if (!p.images.length || !p.images.every((x) => /^img\/products\//.test(x))) return; // keep owner-uploaded photos
      const c = catById(p.categoryId); if (c && /african/.test(c.slug)) return;
      const g = GROUP[p.colors.find((x) => GROUP[x])]; if (!g) return;
      const pool = STOCK[g].filter((x) => ok[x]); if (!pool.length) return;
      const a = pool[p.id % pool.length], b = pool[(p.id + 1) % pool.length];
      p.images = a === b ? [stockUrl(a)] : [stockUrl(a), stockUrl(b)];
    });
  }
  async function loadStore() { const r = await fetch('/api/store'); S = await r.json(); }

  function maybeWelcome() {
    const s = S.settings; if (!s.couponCode) return; if (ls.get('cbk_welcome', 0) > Date.now() - 864e5) return;
    setTimeout(() => {
      if (!(location.hash === '' || location.hash === '#/' ) || $('#mb').classList.contains('open')) return;
      ls.set('cbk_welcome', Date.now()); const p = S.products.find((x) => x.featured) || S.products[0];
      openModal(`<div class="welcome"><div class="art">${p ? `<img src="${esc(p.images[1] || p.images[0])}" alt="">` : ''}</div><div class="body"><span class="tag" style="background:var(--g900);color:#fff;font-size:11px;letter-spacing:.12em;font-weight:700;padding:6px 14px;border-radius:99px">WELCOME OFFER</span><h2>Get ${esc(s.couponPercent)}% off your first order</h2><p style="color:var(--mut)">Use this code at checkout. Pay with M-Pesa or cash on delivery.</p>
        <div class="codebox"><span>${esc(s.couponCode)}</span><button class="btn sm" data-act="welcome-copy">${icon('copy', 15)} Copy</button></div>
        <button class="btn block" data-act="welcome-shop">Start shopping ${icon('arrow', 18)}</button><br><button style="color:var(--mut);font-size:14px;text-decoration:underline" data-act="close-all">No thanks</button></div></div>`);
    }, 7000);
  }

  async function boot() {
    try { await loadStore(); } catch (e) { $('#app').innerHTML = '<div class="boot">Could not load the store. Please refresh.</div>'; return; }
    $('#app').innerHTML = '<div class="scrollbar" id="sb"></div><div id="hdr"></div><main id="main"></main><div id="ftr"></div><div class="overlay" id="ov" data-act="close-all"></div><aside class="drawer" id="cartd" aria-label="Cart"></aside><aside class="drawer left" id="menud" aria-label="Menu"></aside><div class="modal-bg" id="mb"></div><div class="lbx" id="lbx"></div>';
    $('#ftr').innerHTML = footerHTML();
    document.addEventListener('click', onClick);
    $('#mb').addEventListener('click', (e) => { if (e.target === $('#mb')) closeAll(); });
    $('#lbx').addEventListener('click', (e) => { if (e.target === $('#lbx')) closeAll(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) { const b = $('#sugg'); b && b.classList.remove('open'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); if ($('#lbx').classList.contains('open')) { if (e.key === 'ArrowRight') $('#lbx').querySelector('.nx') && $('#lbx').querySelector('.nx').click(); if (e.key === 'ArrowLeft') $('#lbx').querySelector('.pv') && $('#lbx').querySelector('.pv').click(); } });
    window.addEventListener('scroll', () => {
      const y = window.scrollY, h = document.documentElement.scrollHeight - innerHeight; $('#sb').style.width = (h > 0 ? y / h * 100 : 0) + '%';
      const hd = $('#header'); hd && hd.classList.toggle('stuck', y > 80); $('#totop').classList.toggle('show', y > 600);
    }, { passive: true });
    window.addEventListener('hashchange', render);
    // rotate the announcement bar
    setInterval(() => { const sp = $$('#topbar span'); if (sp.length < 2) return; const k = sp.findIndex((x) => x.classList.contains('on')); sp[k].classList.remove('on'); sp[(k + 1) % sp.length].classList.add('on'); }, 4000);
    cart = cart.filter((i) => prodById(i.id)); ls.set('cbk_cart', cart);
    render(); maybeWelcome();
    applyStock().then(() => { if (!document.querySelector('#co') && !$('#mb').classList.contains('open')) { const y = scrollY; render(); scrollTo(0, y); } });
    if (!ls.get('cbk_bub', 0)) setTimeout(() => { const b = $('#wabub'); b && b.classList.add('show'); setTimeout(() => b && b.classList.remove('show'), 9000); }, 12000);
  }
  boot();
})();
