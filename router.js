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

    // Freeze the old page exactly where it sits on screen.
    var a = A.el, H = a.offsetHeight;
    a.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); });
    a.querySelectorAll('[style*="position: fixed"]').forEach(function (e) { e.style.translate = '0 ' + y + 'px'; });
    Object.assign(a.style, { position: 'fixed', top: (-y) + 'px', left: '0', width: '100%', zIndex: '1',
      transformOrigin: '50% ' + y + 'px', transform: 'translateZ(0)', willChange: 'transform, clip-path' });
    document.documentElement.style.background = BG; document.body.style.background = BG;

    // Mount the new page below the fold.
    Object.assign(holder.style, { position: 'fixed', top: '0', left: '0', width: '100%', zIndex: '2',
      transform: 'translate3d(0,' + vh + 'px,0)', willChange: 'transform' });
    root.appendChild(holder);
    window.scrollTo(0, 0);
    cur = mount(key, holder);

    // Keep the menu steady on top while the pages move.
    var nb = navWrap(holder), na = navWrap(a), clone = null;
    if (nb) {
      clone = nb.cloneNode(true); clone.style.zIndex = '50'; clone.style.pointerEvents = 'none';
      clone.removeAttribute('id'); document.body.appendChild(clone);
      nb.style.visibility = 'hidden';
    }
    if (na) na.style.visibility = 'hidden';

    var clip = function (r) { return 'inset(' + y + 'px 0 ' + Math.max(0, H - y - vh) + 'px 0 round ' + r + 'px)'; };
    a.animate([
      { transform: 'translateY(0) scale(1)', clipPath: clip(0), easing: 'cubic-bezier(.3,.7,.4,1)' },
      { offset: .58, transform: 'translateY(' + (vh * .015) + 'px) scale(.88)', clipPath: clip(30), easing: 'cubic-bezier(.55,0,.85,.35)' },
      { transform: 'translateY(' + (-vh * 1.02) + 'px) scale(.88)', clipPath: clip(30) }
    ], { duration: 560, fill: 'forwards' });

    var inA = holder.animate([
      { transform: 'translate3d(0,' + vh + 'px,0)' }, { transform: 'translate3d(0,0,0)' }
    ], { duration: 560, delay: 500, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' });

    inA.onfinish = function () {
      a.remove();
      inA.cancel();
      Object.assign(holder.style, { position: '', top: '', left: '', width: '', zIndex: '', transform: '', willChange: '' });
      if (clone) clone.remove();
      if (nb) nb.style.visibility = '';
      document.documentElement.style.background = ''; document.body.style.background = '';
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize'));
      busy = false;
    };
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
