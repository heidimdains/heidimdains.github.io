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
var OUT = 900, GAP = 0.86, IN = 720;
    // One continuous glide: keeps shrinking the whole way up and out (transform only = GPU-smooth).
    var outT = a.animate([
      { transform: 'translate3d(0,0,0) scale(1)' },
      { offset: .3,  transform: 'translate3d(0,' + (-vh * .03) + 'px,0) scale(.88)' },
      { offset: .65, transform: 'translate3d(0,' + (-vh * .3) + 'px,0) scale(.76)' },
      { transform: 'translate3d(0,' + (-vh * .86) + 'px,0) scale(.64)' }
    ], { duration: OUT, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
    // Corners round off separately so they never slow the movement down.
    a.animate([{ borderRadius: '0px' }, { offset: .35, borderRadius: '30px' }, { borderRadius: '36px' }],
      { duration: OUT, fill: 'forwards' });

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
        try { nb.animate([{ opacity: 0 }, { opacity: 0 }], { duration: Math.round(OUT * GAP) - 60 + IN }); } catch (e) {}
      }
      window.scrollTo(0, 0);
      inA = holder.animate([
        { transform: 'translate3d(0,' + vh + 'px,0)' }, { transform: 'translate3d(0,0,0)' }
      ], { duration: IN, delay: Math.round(OUT * GAP) - 60, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      holder.style.transform = '';          // the animation controls it from here
      try { inA.finished.then(cleanup, cleanup); } catch (e) {}
    }, 60);
    setTimeout(cleanup, Math.round(OUT * GAP) + IN + 200);   // safety net
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
