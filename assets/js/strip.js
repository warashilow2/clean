/* Eco Spark Cleaning - swipe strip pagination

   The reviews are a native scroll-snap row on phones, which is the right
   mechanic but a silent one: with one card filling the screen and the next
   barely peeking, the section reads as though it holds a single review. These
   dots are the missing readout - they say how many there are and where you are
   among them, and they are the only thing here that is not already free from
   the browser.

   Driven by scrollLeft rather than by a click counter, so dragging, flinging
   and clicking a dot all agree with each other. */
(function () {
  'use strict';

  var strips = Array.prototype.slice.call(document.querySelectorAll('[data-strip]'));
  if (!strips.length) return;

  strips.forEach(function (strip) {
    var dots = document.getElementById(strip.dataset.strip);
    if (!dots) return;

    var items = Array.prototype.slice.call(strip.children);
    if (items.length < 2) return;

    var buttons = items.map(function (item, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'strip-dot';
      dot.setAttribute('aria-label', 'Item ' + (i + 1) + ' of ' + items.length);
      dot.addEventListener('click', function () {
        // scroll-padding on the strip already accounts for the gutter, so the
        // item's own offset is the correct target
        strip.scrollTo({ left: item.offsetLeft - items[0].offsetLeft, behavior: 'smooth' });
      });
      dots.appendChild(dot);
      return dot;
    });

    function sync() {
      // the nearest item to the left edge, measured rather than counted: a
      // fling can cross several cards and never fire a click
      var x = strip.scrollLeft;
      var best = 0, bestDist = Infinity;
      items.forEach(function (item, i) {
        var d = Math.abs((item.offsetLeft - items[0].offsetLeft) - x);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      buttons.forEach(function (dot, i) {
        dot.classList.toggle('is-on', i === best);
      });
    }

    var ticking = false;
    strip.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; sync(); });
    }, { passive: true });

    window.addEventListener('resize', sync);
    sync();
  });
})();
