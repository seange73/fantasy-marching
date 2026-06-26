// Shared contextual info popovers. Loaded on every page by js/supabase.js (after
// js/info-content.js). Put a trigger anywhere with:
//   <button class="info-tip" data-info="draft-rules" aria-label="About the draft"></button>
// The glyph is filled in automatically. Clicking it opens a small popover with the
// matching snippet from window.INFO_TOPICS — anchored to the glyph on desktop, a
// bottom sheet on mobile. Mirrors the js/corps-detail.js pattern.
(function () {
  if (window.__infoTipsLoaded) return;
  window.__infoTipsLoaded = true;

  const GLYPH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>' +
    '<line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

  let pop, backdrop, stylesInjected = false, openAnchor = null;

  function topics() { return window.INFO_TOPICS || {}; }

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
.info-tip { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; width: 0.95em; height: 0.95em; min-width: 13px; min-height: 13px; padding: 0; margin-left: 0.35rem; background: transparent; border: none; border-radius: 50%; color: var(--text-3); cursor: pointer; line-height: 0; flex-shrink: 0; transition: color 0.12s; position: relative; top: -0.04em; }
.info-tip svg { width: 100%; height: 100%; }
.info-tip:hover, .info-tip.it-active { color: var(--teal); }
.info-tip:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.it-backdrop { position: fixed; inset: 0; z-index: 1300; display: none; }
.it-backdrop.open { display: block; }
.it-backdrop.it-dim { background: rgba(0,0,0,0.5); }
.it-pop { position: fixed; z-index: 1310; width: 300px; max-width: 92vw; background: var(--s1); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.45); font-family: var(--body); display: none; }
.it-pop.open { display: block; }
.it-pop.it-mobile { left: 50% !important; top: auto !important; bottom: 0; transform: translateX(-50%); width: 100%; max-width: 480px; border-radius: 12px 12px 0 0; }
.it-close { position: absolute; top: 0.45rem; right: 0.55rem; background: transparent; border: none; color: var(--text-3); font-size: 1.25rem; line-height: 1; cursor: pointer; padding: 0 0.2rem; }
.it-close:hover { color: var(--text); }
.it-pop-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--teal); padding: 0.85rem 2rem 0.5rem 1rem; }
.it-pop-body { padding: 0 1rem 1rem; color: var(--text-2); font-size: 0.8rem; line-height: 1.6; max-height: 56vh; overflow-y: auto; }
.it-pop-body p { margin: 0 0 0.6rem; }
.it-pop-body p:last-child { margin-bottom: 0; }
.it-pop-body ul { margin: 0.2rem 0 0.7rem 1.1rem; }
.it-pop-body li { margin-bottom: 0.3rem; }
.it-pop-body strong { color: var(--text); font-weight: 600; }`;
    const tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function ensurePop() {
    if (pop) return;
    injectStyles();
    backdrop = document.createElement('div');
    backdrop.className = 'it-backdrop';
    pop = document.createElement('div');
    pop.className = 'it-pop';
    pop.setAttribute('role', 'dialog');
    document.body.appendChild(backdrop);
    document.body.appendChild(pop);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    // Anchored to a fixed viewport position, so any scroll/resize invalidates it.
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
  }

  function close() {
    if (!pop) return;
    pop.classList.remove('open');
    backdrop.classList.remove('open', 'it-dim');
    if (openAnchor) openAnchor.classList.remove('it-active');
    openAnchor = null;
  }

  function position(anchor) {
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    pop.classList.toggle('it-mobile', isMobile);
    backdrop.classList.toggle('it-dim', isMobile);
    if (isMobile) { pop.style.left = ''; pop.style.top = ''; return; }
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight, m = 8, vw = window.innerWidth, vh = window.innerHeight;
    let left = r.left;
    if (left + pw > vw - m) left = vw - m - pw;
    if (left < m) left = m;
    let top = r.bottom + 6;
    if (top + ph > vh - m) top = r.top - 6 - ph;   // not enough room below -> flip above
    if (top < m) top = m;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function open(id, anchor) {
    const t = topics()[id];
    if (!t) { console.warn('info-tip: unknown topic', id); return; }
    ensurePop();
    pop.innerHTML =
      '<button class="it-close" aria-label="Close">&times;</button>' +
      '<div class="it-pop-title">' + (t.title || '') + '</div>' +
      '<div class="it-pop-body">' + (t.html || '') + '</div>';
    pop.querySelector('.it-close').addEventListener('click', close);
    openAnchor = anchor;
    if (anchor) anchor.classList.add('it-active');
    pop.classList.add('open');
    backdrop.classList.add('open');
    position(anchor);   // measured after it's displayed
  }

  // Delegated: any [data-info] element toggles its popover.
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-info]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    if (openAnchor === el) { close(); return; }
    open(el.getAttribute('data-info'), el);
  });

  // Fill the glyph into any .info-tip trigger that doesn't already have content,
  // including ones added after a dynamic render (call paintInfoTips() then).
  function paintGlyphs(root) {
    (root || document).querySelectorAll('.info-tip:not([data-it-painted])').forEach(b => {
      b.setAttribute('data-it-painted', '1');
      if (!b.innerHTML.trim()) b.innerHTML = GLYPH;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => paintGlyphs());
  else paintGlyphs();

  window.fantasyMarching = window.fantasyMarching || {};
  window.fantasyMarching.paintInfoTips = paintGlyphs;
  window.openInfoTip = open;
})();
