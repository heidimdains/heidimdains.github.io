/* Gentle smooth scrolling for mouse wheels and trackpads.
   Skips touch devices, reduced-motion users, pinch-zoom, and anything
   scrolling inside its own panel (like the Work page pop-ups). */
(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const EASE = 0.075;   // lower = slower, floatier glide
  const SPEED = 0.9;    // wheel distance multiplier
  let target = window.scrollY, cur = window.scrollY, raf = 0;
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

  const innerScroller = (el, dy) => {
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        const atTop = el.scrollTop <= 0, atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if (!((dy < 0 && atTop) || (dy > 0 && atBottom))) return true;
        return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  const tick = () => {
    cur += (target - cur) * EASE;
    if (Math.abs(target - cur) < 0.5) cur = target;
    window.scrollTo(0, cur);
    raf = cur === target ? 0 : requestAnimationFrame(tick);
  };

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;                                   // pinch zoom
    if (document.documentElement.style.overflow === 'hidden') return; // a pop-up is open
    if (innerScroller(e.target, e.deltaY)) return;
    e.preventDefault();
    if (!raf) { cur = window.scrollY; target = cur; }
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
    target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * unit * SPEED));
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: false });

  // Keep in sync with keyboard, scrollbar and anchor-link scrolling.
  window.addEventListener('scroll', () => { if (!raf) { cur = target = window.scrollY; } }, { passive: true });
  window.addEventListener('resize', () => { target = Math.min(target, maxScroll()); });
})();
