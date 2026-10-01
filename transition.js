/* Page transition: the current page shrinks into a card and slides up,
   the next page rises from below. Backdrop is the oxblood panel color. */
(function () {
  var BG = '#3B1620', OUT = 560, IN = 720;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.76,0,.24,1)';
  function root() { return document.getElementById('dc-root'); }

  // Incoming: the head script already added html.hd-in before first paint.
  function enter() {
    var de = document.documentElement;
    if (!de.classList.contains('hd-in')) return;
    var r = root();
    r.style.transformOrigin = '50% ' + (window.innerHeight / 2) + 'px';
    r.style.transform = 'translate3d(0,' + window.innerHeight + 'px,0) scale(.9)';
    r.style.borderRadius = '28px';
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      r.style.transition = 'transform ' + IN + 'ms ' + EASE + ', border-radius ' + IN + 'ms ' + EASE;
      r.style.transform = 'translate3d(0,0,0) scale(1)';
      r.style.borderRadius = '0px';
      setTimeout(function () {
        r.style.transition = r.style.transform = r.style.borderRadius = r.style.transformOrigin = '';
        de.classList.remove('hd-in');
      }, IN + 40);
    }); });
  }

  function leave(href) {
    var r = root(), de = document.documentElement;
    try { sessionStorage.setItem('hd-trans', '1'); } catch (e) {}
    de.style.background = BG; document.body.style.background = BG;
    r.style.background = getComputedStyle(document.body).getPropertyValue('--hd-ground') || '#ECE7DF';
    r.style.overflow = 'hidden';
    r.style.transformOrigin = '50% ' + (window.scrollY + window.innerHeight / 2) + 'px';
    r.style.transition = 'transform ' + OUT + 'ms ' + EASE + ', border-radius ' + OUT + 'ms ' + EASE;
    requestAnimationFrame(function () {
      r.style.transform = 'translate3d(0,' + (-window.innerHeight * 1.05) + 'px,0) scale(.9)';
      r.style.borderRadius = '28px';
    });
    setTimeout(function () { location.href = href; }, OUT - 40);
  }

  document.addEventListener('click', function (e) {
    if (reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;   // same page (hash links etc.)
    e.preventDefault();
    leave(url.href);
  }, true);

  // Back/forward cache: never come back to a half-transitioned page.
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    var r = root(); if (!r) return;
    r.style.transition = r.style.transform = r.style.borderRadius = r.style.overflow = r.style.background = '';
    document.documentElement.style.background = document.body.style.background = '';
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enter); else enter();
})();
