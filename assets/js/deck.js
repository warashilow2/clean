/* Eco Spark Cleaning - before/after coverflow deck

   Ten pairs, five on screen: one at full size in the middle, two smaller either
   side, two smaller again behind those. Every card is absolutely positioned at
   the centre of the stage and pushed out from there, so "which card is where"
   is a single number - its signed distance from the active index - run through
   three lookup tables.

   That distance is fractional while the deck is being dragged, which is why the
   tables are interpolated rather than switched between: the deck follows the
   pointer instead of snapping after it.

   The gesture itself has two rules, both set out under "drag feel" below.
   Sideways wins ties, and once a swipe has been read as sideways the page is
   pinned for the rest of it, so a swipe meant for the cards never turns into a
   scroll halfway through. And a turn is committed by a short push or by speed,
   not by dragging a card the whole way across - a thumb flick is 30 px, not
   150. */
(function () {
  'use strict';

  var deck = document.getElementById('proofDeck');
  var stage = document.getElementById('proofStage');
  if (!deck || !stage) return;

  var cards = Array.prototype.slice.call(stage.querySelectorAll('.proof'));
  var n = cards.length;
  if (!n) return;

  var dots = document.getElementById('proofDots');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Firefox ignores -webkit-user-drag, and the attribute is the portable way to
  // say "this image is not a thing you can pick up and drop somewhere else"
  Array.prototype.forEach.call(stage.querySelectorAll('img'), function (img) {
    img.setAttribute('draggable', 'false');
  });

  /* Vertical wheel is deliberately NOT captured. Turning page scroll into deck
     movement means anyone who scrolls with the cursor over this section cannot
     get past it - the deck loops, so there is no end to release them at. A
     horizontal wheel or trackpad swipe is unambiguous and is captured. Flip
     this to true if that trade is ever worth making. */
  var WHEEL_CAPTURES_VERTICAL = false;

  /* Stops for |distance| = 0, 1, 2, 3. X is in card widths so the deck keeps
     its proportions at any size; past 2 a card is fully transparent and only
     still moving so that it has somewhere to travel from. */
  var X = [0, 0.80, 1.45, 1.86];
  var S = [1, 0.84, 0.68, 0.60];
  var O = [1, 0.82, 0.48, 0];

  /* ------------------------------------------------------------ drag feel

     How far the deck travels for a given amount of finger. Above 1 the deck
     runs slightly ahead of the hand: a card is 80vw on a phone, so at 1:1 a
     flip cost half of that - around 150 px of travel, and only from one
     extreme to the other. That is what made turning the deck feel like work. */
  var DRAG_GAIN = 1.3;

  /* Release rules, and either one on its own is enough: a deliberate push past
     COMMIT of a card width, or a flick of any length faster than FLICK (px per
     ms). Rounding alone needed half a card, so a quick 30 px flick - which is
     what a thumb actually does - used to spring straight back. */
  var COMMIT = 0.15;
  var FLICK = 0.3;

  /* A gesture counts as sideways when it is at least this much more horizontal
     than it is vertical. Below 1 it leans towards the deck on purpose: once a
     swipe has been read as "turn the cards", the page is meant to hold still. */
  var AXIS_BIAS = 0.8;

  var SLOP = 4;    // px of travel before the axis is decided at all

  // one clock for the whole gesture: mixing event timestamps with Date.now()
  // would put the start and the end of a flick on different time origins
  var nowMs = (window.performance && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };

  var active = 0;
  var drag = null;
  var suppressClick = false;
  var spread = reduceMotion ? 1 : 0;   // 0 = cards stacked at centre, 1 = fanned out
  var frame = null;

  /* ------------------------------------------------------------- geometry */

  // shortest signed distance on a loop: card 9 is one step from card 0, not nine
  function wrap(d) {
    d = d % n;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }

  function at(table, t) {
    var i = Math.min(Math.floor(t), table.length - 2);
    var f = Math.max(0, Math.min(1, t - i));
    return table[i] + (table[i + 1] - table[i]) * f;
  }

  function place(pos) {
    var w = cards[0].offsetWidth || 360;

    cards.forEach(function (card, i) {
      var d = wrap(i - pos);
      var t = Math.min(Math.abs(d), X.length - 1);
      var dir = d < 0 ? -1 : 1;

      var x = at(X, t) * w * dir * spread;
      var s = at(S, t);
      var o = at(O, t);

      // the entrance: cards start stacked, small and low, then fan out
      s = 0.7 + (s - 0.7) * spread;
      var y = (1 - spread) * 30;

      card.style.setProperty('--x', x.toFixed(1) + 'px');
      card.style.setProperty('--y', y.toFixed(1) + 'px');
      card.style.setProperty('--s', s.toFixed(3));
      card.style.setProperty('--o', (o * spread).toFixed(3));
      card.style.zIndex = String(100 - Math.round(t * 10));

      // only the card in front is reachable: the ones behind it are decoration
      var front = Math.abs(d) < 0.5;
      card.classList.toggle('is-front', front);
      card.setAttribute('aria-hidden', t > 2.2 ? 'true' : 'false');
      card.style.pointerEvents = t > 2.4 ? 'none' : '';
    });

    if (dots) {
      Array.prototype.forEach.call(dots.children, function (dot, i) {
        var on = i === ((Math.round(pos) % n) + n) % n;
        dot.classList.toggle('is-on', on);
        dot.setAttribute('aria-selected', on ? 'true' : 'false');
        dot.tabIndex = on ? 0 : -1;
      });
    }
  }

  /* Every card is absolutely positioned, so the stage has no content of its own
     to stand the section open - it needs an explicit height, and that height is
     whatever the tallest card turns out to be once fonts have loaded and the
     captions have settled on how many lines they want. Measuring once at start
     is not enough: a ResizeObserver keeps it honest for free. */
  var stageH = 0;
  function sizeStage() {
    var tallest = 0;
    cards.forEach(function (c) { tallest = Math.max(tallest, c.offsetHeight); });
    if (!tallest || tallest === stageH) return false;
    stageH = tallest;
    stage.style.height = tallest + 'px';
    return true;
  }

  /* --------------------------------------------------------------- moving */

  function settle() {
    // snapping is a CSS transition on the cards, so all this has to do is put
    // the deck on a whole number and let them travel
    deck.classList.remove('is-dragging');
    active = ((Math.round(active) % n) + n) % n;
    place(active);
  }

  function go(delta) {
    ensureFanned();
    active = ((Math.round(active + delta) % n) + n) % n;
    settle();
  }

  /* The cards are invisible until the deck fans out, and the fan-out is driven
     by an IntersectionObserver. If that observer somehow never fires, a visitor
     pressing the arrows would be operating a blank section - so any deliberate
     move puts the deck on screen first. Nothing to undo if the observer does
     its job: this is already true by then. */
  function ensureFanned() {
    if (spread >= 1) return;
    if (frame) { cancelAnimationFrame(frame); frame = null; }
    spread = 1;
    deck.classList.add('is-fanned');
  }

  /* --------------------------------------------------------------- drag */

  /* touch-action:pan-y on the stage keeps the page scrollable past the deck:
     a gesture the browser reads as vertical is never ours to begin with, so
     nobody can get stuck on this section. Everything else - including the
     vertical drift inside a sideways swipe - is decided here, by axis, and
     once a swipe is ours the touchmove handler below holds the page still.
     The mouse has no browser-side split at all, so the same check serves it. */
  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;

    // a stale suppression must never outlive the gesture that set it, or the
    // next genuine tap on a side card would be swallowed
    suppressClick = false;

    /* A mouse press on an <img> starts the browser's own drag-and-drop. That
       fires pointercancel, which tears the gesture down before it has begun -
       the deck could be turned with the arrows but not by grabbing it, which is
       exactly what was reported. Cancelling the default here is what makes
       press-and-drag work with a mouse at all. It does not stop the click that
       follows, so clicking a side card still brings it forward. */
    e.preventDefault();

    drag = {
      x: e.clientX, y: e.clientY,
      from: active, locked: false, id: e.pointerId,
      lastX: e.clientX, lastT: nowMs(), vel: 0
    };
  });

  stage.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;

    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;

    if (!drag.locked) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // the axis is decided as early as the slop allows, because the browser is
      // making the same decision at the same moment and whoever commits first
      // owns the gesture
      if (Math.abs(dx) < Math.abs(dy) * AXIS_BIAS) { drag = null; return; }   // that was a scroll
      drag.locked = true;
      ensureFanned();
      deck.classList.add('is-dragging');
      // capture keeps the gesture alive when the pointer leaves the stage, but
      // it throws if the pointer is no longer active - and an exception here
      // would abandon the rest of this move, leaving the deck half-turned
      try { if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId); } catch (err) {}
    }

    /* Speed is read from the last pair of samples rather than from the whole
       gesture: a flick is what the hand was doing at the end, not on average. */
    var now = nowMs();
    var dt = now - drag.lastT;
    if (dt > 0) {
      var v = (e.clientX - drag.lastX) / dt;
      drag.vel = drag.vel * 0.6 + v * 0.4;    // one stray sample must not decide a flick
      drag.lastX = e.clientX;
      drag.lastT = now;
    }

    var w = cards[0].offsetWidth || 360;
    active = drag.from - dx * DRAG_GAIN / w;
    place(active);
  });

  /* Once the swipe is ours the page must not move under it. touch-action can
     only be set before a gesture starts, so holding the page still mid-gesture
     is this handler's job - and it has to be non-passive for preventDefault to
     mean anything. A gesture that never locked is left entirely alone, which
     is what keeps ordinary scrolling over the deck working. */
  stage.addEventListener('touchmove', function (e) {
    if (drag && drag.locked && e.cancelable) e.preventDefault();
  }, { passive: false });

  function endDrag(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (!d.locked) return;
    if (e && stage.releasePointerCapture && stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId)) {
      stage.releasePointerCapture(e.pointerId);
    }
    // the click that follows a drag is the tail of the drag, not a choice of card
    suppressClick = true;

    /* travel is already in cards and already has the gain in it, because that
       is what `active` was being driven by. Forward (the next pair) is
       positive; dragging left raises it, so a leftward flick has negative
       velocity and means forward. */
    var travel = active - d.from;
    var now = nowMs();
    // a finger that came to rest before lifting is not a flick, however fast it
    // was a moment earlier - nothing fires while it is held still, so the last
    // sample would otherwise stand in for the release
    var vel = (now - d.lastT > 90) ? 0 : d.vel;

    var steps = Math.round(travel);
    if (steps === 0) {
      if (Math.abs(vel) > FLICK) steps = vel < 0 ? 1 : -1;
      else if (Math.abs(travel) > COMMIT) steps = travel > 0 ? 1 : -1;
    }

    active = d.from + steps;
    settle();
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  /* A click on a card that is not the front one brings it forward. The drag
     has already settled by the time this runs, so `is-dragging` is gone and
     cannot be the guard - the flag endDrag sets is. */
  stage.addEventListener('click', function (e) {
    if (suppressClick) { suppressClick = false; return; }
    var card = e.target.closest('.proof');
    if (!card) return;
    var i = cards.indexOf(card);
    if (i < 0) return;
    var d = wrap(i - active);
    if (Math.abs(d) >= 0.5) go(d);
  });

  /* ------------------------------------------------------- wheel + keys */

  var wheelLock = 0;
  deck.addEventListener('wheel', function (e) {
    var horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!horizontal && !WHEEL_CAPTURES_VERTICAL) return;   // let the page scroll

    var amount = horizontal ? e.deltaX : e.deltaY;
    if (Math.abs(amount) < 2) return;
    e.preventDefault();

    var now = Date.now();
    if (now - wheelLock < 260) return;     // one notch per gesture, not per event
    wheelLock = now;
    go(amount > 0 ? 1 : -1);
  }, { passive: false });

  deck.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  Array.prototype.forEach.call(deck.querySelectorAll('[data-deck]'), function (btn) {
    btn.addEventListener('click', function () { go(Number(btn.dataset.deck)); });
  });

  /* ----------------------------------------------------------------- dots */

  if (dots) {
    cards.forEach(function (card, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'deck__dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Pair ' + (i + 1));
      dot.addEventListener('click', function () { go(wrap(i - active)); });
      dots.appendChild(dot);
    });
  }

  /* ------------------------------------------------------------ entrance

     The old section faded up as one block, driven by scroll position. That
     reads as a page element arriving; a deck of cards should assemble. So the
     cards start stacked in the middle and fan out to their places once the
     section is properly on screen - the same gesture the deck makes whenever
     you move it, played once on arrival. */

  function fanOut() {
    var start = null, duration = 900;
    function step(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / duration);
      spread = 1 - Math.pow(1 - t, 3);       // ease-out cubic
      place(active);
      if (t < 1) frame = requestAnimationFrame(step);
      else { frame = null; deck.classList.add('is-fanned'); }
    }
    frame = requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------ init */

  sizeStage();
  place(active);

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      sizeStage();
      place(active);
    }, 120);
  });

  if ('ResizeObserver' in window) {
    // sizeStage only writes when the number actually changed, so setting the
    // stage's height cannot feed back into this
    var ro = new ResizeObserver(function () { if (sizeStage()) place(active); });
    cards.forEach(function (c) { ro.observe(c); });
  } else {
    window.addEventListener('load', function () { sizeStage(); place(active); });
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    spread = 1;
    deck.classList.add('is-fanned');
    place(active);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.disconnect();
        sizeStage();
        fanOut();
      });
    }, { rootMargin: '0px 0px -18% 0px', threshold: 0.2 });
    io.observe(deck);
  }
})();
