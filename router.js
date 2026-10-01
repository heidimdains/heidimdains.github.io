/* One-page navigation between Home, Work and About.
   The current page shrinks toward the top, gets flicked away, and the next page
   slides up to replace it (modeled on the reference site). */
(function () {
  var P = window.__dcPages, FILES = {}, BG = '#3B1620';
  Object.keys(P).forEach(function (k) { FILES[P[k].file] = k; });
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mq = matchMedia('(max-width: 760px)');

  // Track window/document listeners so a page can be fully torn down.
  var bucket = null;
  [window, document].forEach(function (t) {
    var add = t.addEventListener;
    t.addEventListener = function (type, fn, opt) {
      if (bucket) bucket.push([t, type, fn, opt]);
      return add.call(t, type, fn, opt);
    };
  });

  function keyFor(url) {
    var f = url.pathname.split('/').pop() || 'index.html';
    return FILES[f] || null;
  }

  var cur = null, busy = false;

  function mount(key, holder) {
    var def = P[key];
    var tpl = (mq.matches && document.getElementById('tpl-' + key + '-m')) ? 'tpl-' + key + '-m' : 'tpl-' + key;
    var list = []; bucket = list;
    var comp = dcMount(def.make(), def.props, tpl, holder);
    document.title = def.title;
    return { key: key, comp: comp, el: holder, list: list };
  }

  function teardown(pg) {
    try { pg.comp.componentWillUnmount && pg.comp.componentWillUnmount(); } catch (e) {}
    pg.list.forEach(function (l) { try { l[0].removeEventListener(l[1], l[2], l[3]); } catch (e) {} });
    pg.comp.setState = function () {};      // ignore late timers
  }

  function navWrap(el) {
    var n = el.querySelector('nav[aria-label="Main"]');
    return n && (n.closest('[style*="position: fixed"]') || n);
  }

  function go(url, push) {
    var key = keyFor(url);
    if (!key || busy) return false;
    if (cur && key === cur.key) {               // same page: let hashes work normally
      if (push) history.pushState(null, '', url.href);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return true;
    }
    if (push) history.pushState(null, '', url.href);
    var A = cur, y = window.scrollY, vh = window.innerHeight;
    var root = document.getElementById('dc-root');
    var holder = document.createElement('div'); holder.className = 'dc-page';
    document.documentElement.style.overflow = ''; document.body.style.overflow = '';

    if (!A || reduce) {
      if (A) { teardown(A); A.el.remove(); }
      root.appendChild(holder); window.scrollTo(0, 0);
      cur = mount(key, holder); return true;
    }
    busy = true;
    teardown(A);

    // Freeze the old page as a screen-sized window onto where it was scrolled.
    var a = A.el;
    a.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); });
    a.querySelectorAll('[style*="position: fixed"]').forEach(function (e) { e.style.translate = '0 ' + y + 'px'; });
    Object.assign(a.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: vh + 'px', overflow: 'hidden',
      zIndex: '1', transformOrigin: '50% 0', willChange: 'transform', borderRadius: '0px' });
    a.scrollTop = y;
    document.documentElement.style.background = BG; document.body.style.background = BG;
    window.scrollTo(0, 0);

    var nb = null, clone = null;
    var na = navWrap(a);
    if (na) {   // a steady copy of the menu rides on top the whole time
      clone = na.cloneNode(true); clone.style.zIndex = '50'; clone.style.pointerEvents = 'none'; clone.style.translate = '';
      document.body.appendChild(clone); na.style.visibility = 'hidden';
    }

    // Old page: settle into a card, then get flicked off the top (GPU-only transforms).
    var EASE_IN = 'cubic-bezier(.5,0,.75,0)';
    a.animate([
      { transform: 'translate3d(0,0,0) scale(1)', easing: 'cubic-bezier(.25,.8,.3,1)' },
      { offset: .55, transform: 'translate3d(0,' + (vh * .02) + 'px,0) scale(.9)', easing: EASE_IN },
      { transform: 'translate3d(0,' + (-vh * 1.05) + 'px,0) scale(.9)' }
    ], { duration: 680, fill: 'forwards' });
    a.animate([{ borderRadius: '0px' }, { offset: .55, borderRadius: '28px' }, { borderRadius: '28px' }],
      { duration: 680, fill: 'forwards' });

    // New page: built a beat later (so the first motion stays smooth), waiting below the screen.
    Object.assign(holder.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: vh + 'px', overflow: 'hidden',
      zIndex: '2', transform: 'translate3d(0,' + vh + 'px,0)', willChange: 'transform' });
    root.appendChild(holder);
    setTimeout(function () {
      cur = mount(key, holder);
      nb = navWrap(holder);
      if (nb) nb.style.visibility = 'hidden';
      if (clone) {          // swap the copy to the new page's menu state
        var c2 = nb ? nb.cloneNode(true) : null;
        if (c2) { c2.style.zIndex = '50'; c2.style.pointerEvents = 'none'; c2.style.visibility = ''; document.body.appendChild(c2); clone.remove(); clone = c2; }
      }
    }, 60);

    var inA = holder.animate([
      { transform: 'translate3d(0,' + vh + 'px,0)' }, { transform: 'translate3d(0,0,0)' }
    ], { duration: 620, delay: 560, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' });

    var finished = false;
    function done() {
      if (finished) return; finished = true;
      // Always hand the page back to normal scrolling first.
      Object.assign(holder.style, { position: '', top: '', left: '', width: '', height: '', overflow: '', zIndex: '', transform: '', willChange: '' });
      try { holder.getAnimations().forEach(function (x) { x.cancel(); }); } catch (e) {}
      try { a.remove(); } catch (e) {}
      try { if (clone) clone.remove(); } catch (e) {}
      if (nb) nb.style.visibility = '';
      document.documentElement.style.background = ''; document.body.style.background = '';
      document.documentElement.style.overflow = ''; document.body.style.overflow = '';
      busy = false;
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize'));
    }
    try { inA.finished.then(done, done); } catch (e) {}
    setTimeout(done, 560 + 620 + 120);   // safety net if the browser never reports the end
    return true;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !keyFor(url)) return;
    if (cur && keyFor(url) === cur.key && url.hash && url.pathname === location.pathname) return; // plain anchor
    e.preventDefault();
    if (busy) return;
    go(url, true);
  });
  window.addEventListener('popstate', function () { go(new URL(location.href), false); });
  mq.addEventListener('change', function () { location.reload(); });

  var start = keyFor(new URL(location.href)) || 'Main';
  var holder = document.createElement('div'); holder.className = 'dc-page';
  document.getElementById('dc-root').appendChild(holder);
  cur = mount(start, holder);
  if (mq.matches) document.documentElement.classList.add('is-mobile');
})();
