/* dc-lite: a tiny runtime for the portfolio's page templates.
   Templates use {{name}} holes, <sc-if value="{{a|b}}"> blocks and onEvent="{{handler}}" attributes.
   Each page defines `class Component extends DCLogic` with renderVals(), and optional lifecycle hooks. */
(function () {
  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; this._queued = false; }
    setState(patch) {
      Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
      if (!this._queued && this._render) {
        this._queued = true;
        queueMicrotask(() => { this._queued = false; this._render(); });
      }
    }
  }
  window.DCLogic = DCLogic;

  const lookup = (vals, expr) => {
    expr = expr.trim();
    if (expr === 'false') return false;
    if (expr === 'true') return true;
    if (expr.includes('|')) return expr.split('|').some(k => !!lookup(vals, k));
    return vals[expr];
  };
  const fill = (tpl, vals) => tpl.replace(HOLE, (_, k) => { const v = lookup(vals, k); return v == null ? '' : String(v); });

  // Compile a DOM subtree: returns list of updater functions.
  function compile(root, scope) {
    const ups = [];
    const walk = (node) => {
      if (node.nodeType === 3) {
        const t = node.nodeValue;
        if (t.includes('{{')) {
          let last;
          ups.push((v) => { const n = fill(t, v); if (n !== last) { node.nodeValue = n; last = n; } });
        }
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.tagName === 'SC-IF') {
        const m = /\{\{\s*([^}]+?)\s*\}\}/.exec(node.getAttribute('value') || '');
        const expr = m ? m[1] : 'false';
        const anchor = document.createComment('sc-if');
        const tpl = document.createDocumentFragment();
        while (node.firstChild) tpl.appendChild(node.firstChild);
        node.parentNode.replaceChild(anchor, node);
        let live = null; // {nodes, ups}
        ups.push((v) => {
          const on = !!lookup(v, expr);
          if (on && !live) {
            const frag = tpl.cloneNode(true);
            const inner = compile(frag, scope);
            const nodes = Array.from(frag.childNodes);
            anchor.parentNode.insertBefore(frag, anchor.nextSibling);
            live = { nodes, ups: inner };
            inner.forEach(u => u(v));
            nodes.forEach(n => n.querySelectorAll && n.querySelectorAll('video[autoplay]').forEach(vd => { vd.muted = true; const p = vd.play(); if (p && p.catch) p.catch(() => {}); }));
          } else if (!on && live) {
            live.nodes.forEach(n => n.parentNode && n.parentNode.removeChild(n));
            live = null;
          } else if (live) {
            live.ups.forEach(u => u(v));
          }
        });
        return;
      }
      for (const attr of Array.from(node.attributes)) {
        const val = attr.value;
        if (!val.includes('{{')) continue;
        const name = attr.name;
        if (name === 'hint-placeholder-val') { node.removeAttribute(name); continue; }
        if (/^on[a-z]/i.test(name)) {
          const key = val.replace(/[{}\s]/g, '');
          const evt = name.slice(2).toLowerCase();
          node.removeAttribute(name);
          node.addEventListener(evt, (e) => { const f = scope.vals[key]; if (typeof f === 'function') f(e); });
          continue;
        }
        let last;
        ups.push((v) => { const n = fill(val, v); if (n !== last) { node.setAttribute(name, n); last = n; } });
      }
      Array.from(node.childNodes).forEach(walk);
    };
    if (root.nodeType === 11) Array.from(root.childNodes).forEach(walk); else walk(root);
    return ups;
  }

  window.dcMount = function (Component, props, tplId, container) {
    const tplEl = document.getElementById(tplId || 'dc-tpl');
    const frag = tplEl.content.cloneNode(true);
    const comp = new Component(props || {});
    const scope = { vals: {} };
    const ups = compile(frag, scope);
    comp._render = () => {
      scope.vals = comp.renderVals();
      ups.forEach(u => u(scope.vals));
    };
    scope.vals = comp.renderVals();
    ups.forEach(u => u(scope.vals));
    (container || document.getElementById('dc-root')).appendChild(frag);
    if (comp.componentDidMount) comp.componentDidMount();
    return comp;
  };
})();
