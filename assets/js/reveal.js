/* Eco Spark Cleaning - scroll reveals
   Two mechanisms live here:
   1. A generic one-shot fade-up for `[data-reveal]` elements - used for the
      staggered cascade on cards inside a section that already has its own
      `.emerge` treatment.
   2. A continuous scroll-linked "emerge" for any `.emerge` section: opacity
      and position are a direct function of scroll position, not a
      fixed-duration transition triggered once - the section tracks the
      wheel/finger instead of racing it. Every section that opts in (Results,
      Reviews, and whatever comes next) shares the exact same feel. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------- one-shot fade-up */

  var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  if (items.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-inview'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-inview');
          io.unobserve(entry.target);
        });
        /* Trip point. Two failure modes to stay between: fire too early and the
           animation burns out below the fold, so the visitor scrolls down to
           something that already arrived; fire too late and they have to scroll
           well past a card before it deigns to appear, which is what the
           service cards were doing at 25% of a 22%-shortened viewport.
           A tenth of the element inside a viewport shortened by 15% puts the
           trigger at roughly "the top edge is four fifths of the way down the
           screen" for a card of any size - on its way in, clearly, but with the
           whole entrance still ahead of it. */
      }, { rootMargin: '0px 0px -15% 0px', threshold: 0.1 });

      items.forEach(function (el) { io.observe(el); });

      // No blanket fallback timer here on purpose: an earlier version force-
      // revealed every [data-reveal] element 3s after page load "just in
      // case" the observer never fired. For anything below the fold - which
      // is the whole point of a scroll reveal - that meant it was already
      // marked is-inview, invisibly, before the visitor ever scrolled that
      // far, so the animation had silently used itself up by the time they
      // arrived. IntersectionObserver is a mature, universally-supported
      // API; it does not need a defensive timer that undermines the exact
      // effect it exists to produce.
    }
  }

  /* --------------------------------------------------- continuous emerge */

  var sections = Array.prototype.slice.call(document.querySelectorAll('.emerge'));
  if (!sections.length || reduceMotion) return;   // reduced motion: CSS default (--emerge:1) stands, static and visible

  var ticking = false;

  function progressFor(section) {
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight;

    // rect.top goes from vh (just touching the bottom edge) down to this
    // target, which is where the section counts as "fully on screen": for a
    // section shorter than the viewport that's the point where its bottom
    // meets the viewport bottom; for one taller than the viewport, full
    // containment is impossible, so the target falls back to "top has reached
    // the top of the viewport" - the best "as visible as it gets" position.
    var target = Math.max(0, vh - rect.height);
    var p = (vh - rect.top) / (vh - target || 1);
    return Math.max(0, Math.min(1, p));
  }

  function update() {
    ticking = false;
    sections.forEach(function (section) {
      var progress = progressFor(section);

      // Linear progress makes the top of a section pop in at a visible
      // opacity almost immediately - the first sliver to scroll into view is
      // exactly the top edge, so it needs to stay close to invisible for a
      // while. Cubic ease-in holds it near ~3% until about a third of the way
      // through the range, then accelerates up to 100% as the section
      // settles into full view.
      var eased = progress * progress * progress;
      section.style.setProperty('--emerge', eased.toFixed(3));
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();   // in case a section is already on screen at load (e.g. a mid-page refresh)
})();
