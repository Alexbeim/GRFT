/*
 * gal-nav.js — shared script for every gal/*.html project page.
 *
 * Two features:
 *  1. Prev / All / Next navigation bar (replaces the plain "← Back to Gallery"
 *     link). Project order is pulled from gallery.html so it stays in sync
 *     automatically — no per-page hardcoding.
 *  2. Sound toggle button on the hero video (since videos autoplay muted).
 *     Sound preference persists in localStorage so once enabled on one
 *     project page, it stays on for all subsequent project pages.
 *
 * Keyboard: ← / → arrows navigate between projects.
 */

(function () {
  'use strict';

  // ── PREV / ALL / NEXT NAVIGATION ──────────────────────────────────────────
  async function setupNav() {
    const back = document.querySelector('.gal-story-back');
    if (!back) return;

    let projects = [];
    try {
      const res = await fetch('../gallery.html', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      projects = [...doc.querySelectorAll('.gallery-item')].map(a => {
        const href = a.getAttribute('href') || '';
        const cap = a.querySelector('.gallery-caption');
        const parts = cap
          ? cap.innerHTML.split(/<br\s*\/?>(?:\s*)/i).map(s => s.replace(/<[^>]+>/g, '').trim())
          : [];
        return { href, name: parts[0] || '', location: parts[1] || '' };
      });
    } catch (e) {
      console.warn('[gal-nav] could not load project list:', e);
      return;
    }

    // Find the current page in the list. Project URLs in gallery.html are
    // relative ("gal/foo.html"); we're on /gal/foo.html, so compare filenames.
    const currentSlug = location.pathname.split('/').pop();
    const idx = projects.findIndex(p => p.href.split('/').pop() === currentSlug);
    if (idx === -1) return;

    const prev = idx > 0 ? projects[idx - 1] : null;
    const next = idx < projects.length - 1 ? projects[idx + 1] : null;

    // Project URLs in gallery.html are "gal/foo.html"; from inside gal/ that
    // becomes just "foo.html".
    const stripGal = (h) => h.replace(/^gal\//, '');

    back.classList.add('gal-story-back--nav');
    back.innerHTML = `
      ${prev
        ? `<a class="gal-nav-side gal-nav-prev" href="${stripGal(prev.href)}" aria-label="Previous: ${escapeAttr(prev.name)}">
             <span class="gal-nav-arrow" aria-hidden="true">←</span>
             <span class="gal-nav-side-text">
               <span class="gal-nav-side-eyebrow">Previous</span>
               <span class="gal-nav-side-name">${escapeHtml(prev.name)}</span>
             </span>
           </a>`
        : '<span class="gal-nav-side gal-nav-side--empty"></span>'}
      <a class="gal-nav-center" href="../gallery.html">
        <span class="gal-nav-center-label">All projects</span>
        <span class="gal-nav-center-count">${idx + 1} / ${projects.length}</span>
      </a>
      ${next
        ? `<a class="gal-nav-side gal-nav-next" href="${stripGal(next.href)}" aria-label="Next: ${escapeAttr(next.name)}">
             <span class="gal-nav-side-text">
               <span class="gal-nav-side-eyebrow">Next</span>
               <span class="gal-nav-side-name">${escapeHtml(next.name)}</span>
             </span>
             <span class="gal-nav-arrow" aria-hidden="true">→</span>
           </a>`
        : '<span class="gal-nav-side gal-nav-side--empty"></span>'}
    `;

    // Keyboard ←/→
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft'  && prev) { location.href = stripGal(prev.href); e.preventDefault(); }
      if (e.key === 'ArrowRight' && next) { location.href = stripGal(next.href); e.preventDefault(); }
    });
  }

  // ── SOUND TOGGLE ──────────────────────────────────────────────────────────
  // Handled site-wide by js/video-sound.js, which only shows the control on
  // videos that actually carry an audio track (most project clips are exported
  // silent). Load it once here so every project page picks it up.
  function loadVideoSound() {
    if (document.querySelector('script[data-video-sound]')) return;
    const s = document.createElement('script');
    s.src = '/js/video-sound.js';
    s.defer = true;
    s.setAttribute('data-video-sound', '');
    document.head.appendChild(s);
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── boot ───────────────────────────────────────────────────────────────────
  loadVideoSound();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupNav);
  } else {
    setupNav();
  }
})();
