/*
 * video-sound.js — site-wide sound toggle for autoplay videos.
 *
 * Autoplaying videos must start muted (browser policy), so this adds a small
 * speaker button that lets a visitor turn sound ON for any video that actually
 * carries an audio track. Videos exported silent get no button — the control
 * only appears where there's something to hear.
 *
 * A video is treated as having audio when ANY of these is true:
 *   • it has a  data-has-audio  attribute (deterministic — set this in the HTML
 *     for files you know contain audio; it's the only reliable signal in
 *     Chrome, which can't probe an audio track while the video is muted), or
 *   • the browser reports an audio track at runtime (Firefox / Safari).
 * Add  data-no-sound  to opt a video out entirely (e.g. decorative b-roll).
 *
 * Only one video plays sound at a time: unmuting one mutes the others.
 * Reuses the .gal-sound-btn styling already in style-v4.css.
 *
 * Loaded directly on top-level pages and injected by js/gal-nav.js on project
 * pages, so it runs everywhere. Safe to load more than once.
 */
(function () {
  'use strict';
  if (window.__grftVideoSound) return;
  window.__grftVideoSound = true;

  var SOUND_KEY = 'grft-gal-sound';

  var ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.17v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>';
  var ICON_ON  = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';

  var wired = []; // { video, btn, render }

  function allVideos() {
    return Array.prototype.slice.call(document.querySelectorAll('video'));
  }

  function hasAudio(v) {
    if (v.hasAttribute('data-no-sound')) return false;
    if (v.hasAttribute('data-has-audio')) return true;
    if (typeof v.mozHasAudio === 'boolean') return v.mozHasAudio;          // Firefox
    if (v.audioTracks && typeof v.audioTracks.length === 'number') {       // Safari
      return v.audioTracks.length > 0;
    }
    return false; // Chrome can't tell while muted — rely on data-has-audio
  }

  function renderAll() { wired.forEach(function (w) { w.render(); }); }

  function muteOthers(except) {
    allVideos().forEach(function (v) { if (v !== except) v.muted = true; });
    renderAll();
  }

  function attach(video) {
    if (video.__soundWired) return;
    video.__soundWired = true;

    var btn = document.createElement('button');
    btn.className = 'gal-sound-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle sound');

    function render() {
      btn.dataset.state = video.muted ? 'off' : 'on';
      btn.innerHTML = video.muted ? ICON_OFF : ICON_ON;
      btn.title = video.muted ? 'Enable sound' : 'Mute';
    }

    btn.addEventListener('click', function () {
      if (video.muted) {
        muteOthers(video);
        video.muted = false;
        try { localStorage.setItem(SOUND_KEY, '1'); } catch (e) {}
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        video.muted = true;
        try { localStorage.setItem(SOUND_KEY, '0'); } catch (e) {}
      }
      render();
    });

    var parent = video.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      parent.appendChild(btn);
    }
    render();
    wired.push({ video: video, btn: btn, render: render });
  }

  function consider(video) {
    if (video.__soundWired) return;
    if (hasAudio(video)) { attach(video); return; }
    // audioTracks can populate only once metadata arrives — re-check then.
    ['loadedmetadata', 'canplay'].forEach(function (ev) {
      video.addEventListener(ev, function () { if (hasAudio(video)) attach(video); }, { once: true });
    });
  }

  function init() { allVideos().forEach(consider); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
