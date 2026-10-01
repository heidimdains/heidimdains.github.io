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
    if (window.__smoothStop) window.__smoothStop();   // no leftover scroll glide during the move
    teardown(A);

    // Old page: a click-through, screen-sized overlay frozen where it was scrolled.
    var a = A.el;
    a.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); });
    a.querySelectorAll('[style*="position: fixed"]').forEach(function (e) { e.style.translate = '0 ' + y + 'px'; });
    Object.assign(a.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: vh + 'px', overflow: 'hidden',
      zIndex: '40', pointerEvents: 'none', transformOrigin: '50% 0', willChange: 'transform' });
    a.scrollTop = y;
    document.documentElement.style.background = BG; document.body.style.background = BG;

    function pin(el) {
      if (!el) return null;
      var c = el.cloneNode(true);
      c.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); }); c.removeAttribute('id');
      Object.assign(c.style, { zIndex: '60', pointerEvents: 'none', translate: '', visibility: '' });
      document.body.appendChild(c); return c;
    }
    var pinned = null;
    var dropPin = function () { if (pinned) { pinned.remove(); pinned = null; } };

    // New page: built first, while it waits out of sight below the screen.
    root.appendChild(holder);
    holder.style.transform = 'translate3d(0,' + vh + 'px,0)';
    try { cur = mount(key, holder); } catch (e) { console.error(e); }
    window.scrollTo(0, 0);
    var nb = navWrap(holder);
    pinned = pin(nb);
    var na = navWrap(a); if (na) na.style.opacity = '0';

    var OUT = 950, IN = 760, START = Math.round(OUT * 0.84);
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

    // Start moving only once the new page has been laid out, so nothing interrupts the glide.
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      // One unbroken curve: it shrinks as it rises, all the way out of view.
      a.animate([
        { transform: 'translate3d(0,0,0) scale(1)' },
        { transform: 'translate3d(0,' + (-vh * .9) + 'px,0) scale(.62)' }
      ], { duration: OUT, easing: 'cubic-bezier(.62,0,.38,1)', fill: 'forwards' });
      a.animate([{ borderRadius: '0px' }, { borderRadius: '34px' }],
        { duration: 260, easing: 'ease-out', fill: 'forwards' });
      if (nb) { try { nb.animate([{ opacity: 0 }, { opacity: 0 }], { duration: START + IN }); } catch (e) {} }
      inA = holder.animate([
        { transform: 'translate3d(0,' + vh + 'px,0)' }, { transform: 'translate3d(0,0,0)' }
      ], { duration: IN, delay: START, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      holder.style.transform = '';
      try { inA.finished.then(cleanup, cleanup); } catch (e) {}
      setTimeout(cleanup, START + IN + 250);   // safety net
    }); });
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


  // About photo strip: hovering eases it down to a slow drift instead of stopping.
  (function () {
    var target = 1, rate = 1, raf = 0, strip = null;
    function anim() { var el = document.querySelector('.marquee'); return el && el.getAnimations ? el.getAnimations()[0] : null; }
    function step() {
      rate += (target - rate) * 0.08;
      if (Math.abs(target - rate) < 0.005) rate = target;
      var a = anim(); if (a) a.playbackRate = rate;
      raf = rate === target ? 0 : requestAnimationFrame(step);
    }
    function set(t) { target = t; if (!raf) raf = requestAnimationFrame(step); }
    document.addEventListener('mouseover', function (e) { var w = e.target.closest && e.target.closest('.marquee-wrap'); if (w && !strip) { strip = w; set(0.25); } });
    document.addEventListener('mouseout', function (e) {
      if (!strip) return; var to = e.relatedTarget;
      if (!to || !strip.contains(to)) { strip = null; set(1); }
    });
  })();
  var start = keyFor(new URL(location.href)) || 'Main';
  var holder = document.createElement('div'); holder.className = 'dc-page';
  document.getElementById('dc-root').appendChild(holder);
  cur = mount(start, holder);
  if (mq.matches) document.documentElement.classList.add('is-mobile');
})();
