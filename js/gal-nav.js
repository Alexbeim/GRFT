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

  const SOUND_KEY = 'grft-gal-sound';

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

  // ── SOUND TOGGLE on hero video ────────────────────────────────────────────
  function setupSound() {
    const video = document.querySelector('.gal-story-hero video');
    if (!video) return;

    const wantSound = localStorage.getItem(SOUND_KEY) === '1';
    video.muted = !wantSound;

    const btn = document.createElement('button');
    btn.className = 'gal-sound-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle sound');

    const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.17v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>';
    const ICON_ON  = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';

    function render() {
      btn.dataset.state = video.muted ? 'off' : 'on';
      btn.innerHTML = video.muted ? ICON_OFF : ICON_ON;
      btn.title = video.muted ? 'Enable sound' : 'Mute';
    }
    render();

    btn.addEventListener('click', async () => {
      video.muted = !video.muted;
      localStorage.setItem(SOUND_KEY, video.muted ? '0' : '1');
      if (!video.muted) {
        // Safari/iOS may need an explicit play() after unmuting via gesture.
        try { await video.play(); } catch (e) { /* ignore */ }
      }
      render();
    });

    const hero = video.parentElement;
    if (hero) {
      const cs = getComputedStyle(hero);
      if (cs.position === 'static') hero.style.position = 'relative';
      hero.appendChild(btn);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── boot ───────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { setupNav(); setupSound(); });
  } else {
    setupNav();
    setupSound();
  }
})();
