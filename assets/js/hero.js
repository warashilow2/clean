/* Eco Spark Cleaning — header behaviour + hero video background
   No dependencies. Every effect degrades to the poster images. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- header */

  var header = document.getElementById('siteHeader');

  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ------------------------------------------------------- sticky call bar

     Phones get a fixed row of actions along the bottom, but not over the hero:
     the hero already carries the same three CTAs, and covering them with a
     smaller copy of themselves helps nobody. So it appears exactly when the
     hero leaves, which an observer on the hero answers directly - no scroll
     maths, no magic offset that drifts when the hero's height changes.

     `hidden` is the resting state so the bar is absent for anyone whose JS
     never runs, rather than pinned over the page. */
  var callbar = document.getElementById('callbar');
  var heroEl = document.querySelector('.hero');

  if (callbar && heroEl && 'IntersectionObserver' in window) {
    callbar.hidden = false;
    new IntersectionObserver(function (entries) {
      callbar.classList.toggle('is-up', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(heroEl);
  }

  var yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ----------------------------------------------------------- mobile menu */

  var toggle = document.getElementById('menuToggle');
  var menu = document.getElementById('mobileMenu');

  function openMenu() {
    menu.hidden = false;
    // next frame, so the transition has a starting point to animate from
    requestAnimationFrame(function () { menu.classList.add('is-open'); });
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('is-locked');
  }

  function closeMenu() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('is-locked');
    window.setTimeout(function () {
      if (!menu.classList.contains('is-open')) menu.hidden = true;
    }, 300);
    toggle.focus();
  }

  toggle.addEventListener('click', function () {
    if (toggle.getAttribute('aria-expanded') === 'true') closeMenu();
    else openMenu();
  });

  menu.addEventListener('click', function (e) {
    // links and the calculator trigger both take over from the menu
    if (e.target.closest('a, [data-open-calc]')) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu();
  });

  /* ------------------------------------------------------ hero video loop */

  var videos = Array.prototype.slice.call(document.querySelectorAll('.hero__video'));
  if (!videos.length) return;

  // `media` on <source> inside <video> is not honoured by browsers,
  // so the right encode is picked here instead.
  var isMobile = window.matchMedia('(max-width: 767px)').matches;

  function attach(video) {
    if (video.src) return;
    video.src = isMobile ? video.dataset.srcMobile : video.dataset.srcDesktop;
    video.load();
  }

  videos.forEach(function (v) {
    if (isMobile && v.poster) v.poster = v.poster.replace('-poster.jpg', '-poster-mobile.jpg');
    v.muted = true;          // set again in JS: some browsers ignore the attribute alone
  });

  // only the first clip is fetched up front; the other two are pulled in once
  // it is running, so the first paint isn't waiting on 2.5 MB of video
  attach(videos[0]);
  var restLoaded = false;
  function loadRest() {
    if (restLoaded) return;
    restLoaded = true;
    videos.slice(1).forEach(attach);
  }
  videos[0].addEventListener('playing', loadRest, { once: true });
  window.setTimeout(loadRest, 4000);   // fallback if autoplay never starts

  if (reduceMotion) return;  // posters only — nothing else to do

  var current = 0;
  var switching = false;
  var FADE_LEAD = 0.9;       // start the next clip this many seconds before the end

  function play(video) {
    var p = video.play();
    if (p && typeof p.catch === 'function') {
      // autoplay can be refused (low power mode); the poster stays, no noise in console
      p.catch(function () {});
    }
  }

  function restartZoom(video) {
    video.style.animation = 'none';
    void video.offsetWidth;            // force reflow so the animation replays
    video.style.animation = '';
  }

  function show(index) {
    if (index === current || switching) return;
    switching = true;

    var prev = videos[current];
    var next = videos[index];

    attach(next);
    if (next.readyState > 0) next.currentTime = 0;
    play(next);
    restartZoom(next);
    next.classList.add('is-active');
    prev.classList.remove('is-active');
    current = index;

    // let the crossfade finish before parking the previous clip
    window.setTimeout(function () {
      prev.pause();
      prev.currentTime = 0;
      switching = false;
    }, 1200);
  }

  videos.forEach(function (v, i) {
    v.addEventListener('timeupdate', function () {
      if (i !== current || switching || !v.duration) return;
      if (v.duration - v.currentTime <= FADE_LEAD) {
        show((current + 1) % videos.length);
      }
    });

    // safety net: if timeupdate is throttled (background tab), advance on end
    v.addEventListener('ended', function () {
      if (i === current) show((current + 1) % videos.length);
    });
  });

  // pause the loop while the tab is hidden — no point burning battery on it
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) videos[current].pause();
    else play(videos[current]);
  });

  play(videos[0]);
})();
