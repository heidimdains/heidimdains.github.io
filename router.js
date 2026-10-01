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

    // Old page becomes a click-through, screen-sized overlay frozen where it was scrolled.
    var a = A.el;
    a.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); });
    a.querySelectorAll('[style*="position: fixed"]').forEach(function (e) { e.style.translate = '0 ' + y + 'px'; });
    Object.assign(a.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: vh + 'px', overflow: 'hidden',
      zIndex: '40', pointerEvents: 'none', transformOrigin: '50% 0', borderRadius: '0px' });
    a.scrollTop = y;
    document.documentElement.style.background = BG; document.body.style.background = BG;

    function pin(el) {
      if (!el) return null;
      var c = el.cloneNode(true);
      c.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); }); c.removeAttribute('id');
      Object.assign(c.style, { zIndex: '60', pointerEvents: 'none', translate: '', visibility: '' });
      document.body.appendChild(c); return c;
    }
    var pinned = pin(navWrap(a));
    var na = navWrap(a); if (na) na.style.opacity = '0';
    var dropPin = function () { if (pinned) { pinned.remove(); pinned = null; } };
    var outT = a.animate([
      { transform: 'translate3d(0,0,0) scale(1)', borderRadius: '0px', easing: 'cubic-bezier(.25,.8,.3,1)' },
      { offset: .55, transform: 'translate3d(0,' + (vh * .02) + 'px,0) scale(.9)', borderRadius: '28px', easing: 'cubic-bezier(.5,0,.75,0)' },
      { transform: 'translate3d(0,' + (-vh * 1.08) + 'px,0) scale(.9)', borderRadius: '28px' }
    ], { duration: 680, fill: 'forwards' });

    // New page: an ordinary page in normal flow at the top, simply slid in from below.
    root.appendChild(holder);
    window.scrollTo(0, 0);
    holder.style.transform = 'translate3d(0,' + vh + 'px,0)';
    var finished = false, inA = null;
    function cleanup() {
      if (finished) return; finished = true;
      holder.style.transform = '';
      try { if (inA) inA.cancel(); } catch (e) {}
      try { a.remove(); } catch (e) {}
      dropPin();
      document.documentElement.style.background = ''; document.body.style.background = '';
      busy = false;
      window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize'));
    }
    setTimeout(function () {
      try { cur = mount(key, holder); } catch (e) { console.error(e); }
      var nb = navWrap(holder);
      if (nb) {
        var p2 = pin(nb); dropPin(); pinned = p2;
        try { nb.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 500 + 620 }); } catch (e) {}
      }
      window.scrollTo(0, 0);
      inA = holder.animate([
        { transform: 'translate3d(0,' + vh + 'px,0)' }, { transform: 'translate3d(0,0,0)' }
      ], { duration: 620, delay: 500, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'backwards' });
      holder.style.transform = '';          // the animation controls it from here
      try { inA.finished.then(cleanup, cleanup); } catch (e) {}
    }, 60);
    setTimeout(cleanup, 60 + 500 + 620 + 150);   // safety net
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
