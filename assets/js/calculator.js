/* Eco Spark Cleaning — cost calculator
   Prices carried over from the previous site (index.html:1561-1571).
   No discounts: the 15% Facebook/Instagram rule was dropped on purpose. */
(function () {
  'use strict';

  var form = document.getElementById('calcForm');
  if (!form) return;

  /* ------------------------------------------------------------- pricing */

  var PER_ROOM = {
    standard:   { bedroom: 20, bathroom: 35 },
    deep:       { bedroom: 30, bathroom: 52 },
    renovation: { bedroom: 32, bathroom: 56 }
  };

  /* Deep Plus is a deep clean with three of the extras already in it, not a
     fourth price list: same rooms, same rates, plus the fridge, the microwave
     and the inside of the kitchen cupboards. Aliasing the tables rather than
     copying the numbers means a change to the deep rates can never leave the
     two silently disagreeing. */
  PER_ROOM.deepplus = PER_ROOM.deep;

  /* The "from" price on each card is kitchen + living room + 1 bedroom + 1 bathroom.
     New targets (12.08.2026): standard €129, deep €199, renovation €214 — reached by
     moving the kitchen rate only, so the per-room rates above stay untouched. */
  var FIXED = {                       // every quote includes one of each
    standard:   { livingRoom: 26, kitchen: 48 },   // 48 + 26 + 20 + 35 = 129
    deep:       { livingRoom: 39, kitchen: 78 },   // 78 + 39 + 30 + 52 = 199
    renovation: { livingRoom: 42, kitchen: 84 }    // 84 + 42 + 32 + 56 = 214
  };
  FIXED.deepplus = FIXED.deep;

  var EXTRAS = {
    oven:       { label: 'Oven cleaning',       price: 55 },
    microwave:  { label: 'Microwave',           price: 15 },
    fridge:     { label: 'Fridge',              price: 15 },
    upholstery: { label: 'Upholstery cleaning', price: 40 },
    cabinets:   { label: 'Kitchen cabinets',    price: 35 }
  };

  /* The Deep Plus package. Its three jobs are ordinary extras, ticked and
     locked on step 2 rather than hidden, so the price can be checked against
     the same list everyone else buys from: 199 + 15 + 15 + 35 = 264, sold at
     249. That 264 is what the card shows struck through, and it is an
     arithmetic fact rather than a price we once charged - which is the only
     kind of "was" price that is lawful to show here. Change the saving and the
     struck figures in index.html have to move with it. */
  var PACK = {
    extras: ["fridge", "microwave", "cabinets"],
    saving: 15
  };

  var WINDOWS = {
    inside:  [0, 8, 15, 22, 28, 34],    // index = number of windows
    outside: [0, 11, 20, 28, 36, 44]
  };

  var FRAME_PRICE = 7;

  /* One-time offer shown when someone tries to leave the calculator: three
     inside windows for free. WINDOWS.inside[3] is what it takes off the quote. */
  var BONUS_WINDOWS = 3;
  var bonusTaken = false;

  var TYPE_LABEL = {
    standard: 'Standard cleaning',
    deep: 'Deep cleaning',
    deepplus: 'Deep Plus',
    renovation: 'After renovation'
  };

  /* Hourly hire is priced on people and time rather than rooms, so it does not
     go through PER_ROOM/FIXED/EXTRAS at all - it is its own branch from the
     panel down to the message the office receives. The three-hour minimum is
     the call-out floor and is enforced on the input as well as in the maths. */
  var HOURLY_RATE = 29;
  var HOURLY_MIN_HOURS = 3;

  /* Every request the site can produce leaves through here, and through here
     only. This replaced a direct call to api.telegram.org with the bot token
     written into this file, where anyone opening the source could read it and
     post as the bot. A webhook URL is meant to be called from a browser, so
     nothing secret is left in the client - and the standing job of re-issuing
     that token before launch is gone with it. */
  var N8N_ENDPOINT = 'https://wara1561.app.n8n.cloud/webhook/ecospark-lead';

  /* --------------------------------------------------------------- state */

  function num(name, fallback) {
    var el = form.elements[name];
    var v = parseInt(el && el.value, 10);
    if (isNaN(v) || v < 0) v = fallback;
    // the counter buttons already clamp; this catches a value typed straight
    // into the field, which is how someone could ask for one hour of a
    // three-hour minimum and be quoted for it
    var min = el && parseInt(el.min, 10);
    var max = el && parseInt(el.max, 10);
    if (!isNaN(min) && v < min) v = min;
    if (max && v > max) v = max;
    return v;
  }

  function read() {
    var type = (form.elements.type.value || 'deep');
    var extras = [];
    Array.prototype.forEach.call(form.querySelectorAll('input[name="extra"]:checked'), function (el) {
      extras.push(el.value);
    });
    return {
      type: type,
      bedrooms: num('bedrooms', 0),
      bathrooms: num('bathrooms', 0),
      extras: extras,
      winInside: parseInt(form.elements.winInside.value, 10) || 0,
      winOutside: parseInt(form.elements.winOutside.value, 10) || 0,
      frames: num('frames', 0)
    };
  }

  function lines(s, bonus) {
    if (bonus === undefined) bonus = bonusTaken;
    var out = [];
    var per = PER_ROOM[s.type];
    var fixed = FIXED[s.type];

    out.push({ label: TYPE_LABEL[s.type] + ' - kitchen & living room', amount: fixed.kitchen + fixed.livingRoom });
    if (s.bedrooms) out.push({ label: s.bedrooms + ' × bedroom', amount: s.bedrooms * per.bedroom });
    if (s.bathrooms) out.push({ label: s.bathrooms + ' × bathroom', amount: s.bathrooms * per.bathroom });

    s.extras.forEach(function (key) {
      if (EXTRAS[key]) out.push({ label: EXTRAS[key].label, amount: EXTRAS[key].price });
    });

    /* The three pack jobs are already in s.extras - syncPack() ticks the real
       checkboxes, so they are read back like any other extra and can never be
       counted twice. All that is left here is the discount, kept as its own
       line so the office sees what the package is made of and what it cost. */
    if (s.type === 'deepplus') {
      out.push({ label: 'Deep Plus package - saving', amount: -PACK.saving });
    }

    if (s.winInside) out.push({ label: s.winInside + ' × window inside', amount: WINDOWS.inside[s.winInside] });
    if (s.winOutside) out.push({ label: s.winOutside + ' × window outside', amount: WINDOWS.outside[s.winOutside] });
    if (s.frames) out.push({ label: s.frames + ' × window frame', amount: s.frames * FRAME_PRICE });

    // the gift comes off the inside windows and can never push the quote below zero
    if (bonus) {
      var waived = Math.min(WINDOWS.inside[BONUS_WINDOWS], WINDOWS.inside[s.winInside] || 0);
      if (waived) out.push({ label: BONUS_WINDOWS + ' × window inside - free', amount: -waived });
    }

    return out;
  }

  function total(items) {
    return items.reduce(function (sum, item) { return sum + item.amount; }, 0);
  }

  /* ------------------------------------------------------- hourly branch */

  function readHourly() {
    return {
      cleaners: num('cleaners', 1),
      hours: num('hours', HOURLY_MIN_HOURS)
    };
  }

  // same {label, amount} shape as lines(), so total() and the sending code
  // downstream do not need to know which branch produced them
  function hourlyLines(s) {
    return [{
      label: s.cleaners + ' × cleaner for ' + s.hours + ' hours at €' + HOURLY_RATE + '/hour',
      amount: s.cleaners * s.hours * HOURLY_RATE
    }];
  }

  /* -------------------------------------------------------------- render */

  var summaryTotal = document.getElementById('summaryTotal');
  var summaryBonus = document.getElementById('summaryBonus');
  var hourlyTotal = document.getElementById('hourlyTotal');
  var hourlyLine = document.getElementById('hourlyLine');

  /* Picking Deep Plus ticks the three extras it covers and locks them; picking
     anything else releases them. They are left on screen rather than hidden on
     purpose - seeing the same checkboxes ticked is what tells someone the
     package is three ordinary extras at a discount and not a number we made
     up. Only boxes this function disabled are cleared, so a tick the visitor
     made themselves on another type is never thrown away.

     Setting .checked from script fires no change event, so calling this from
     render() cannot loop. */
  function syncPack() {
    var on = form.elements.type.value === 'deepplus';
    PACK.extras.forEach(function (key) {
      var box = form.querySelector('input[name="extra"][value="' + key + '"]');
      if (!box) return;
      if (on) {
        box.checked = true;
        box.disabled = true;
      } else if (box.disabled) {
        box.disabled = false;
        box.checked = false;
      }
      var card = box.closest('.opt');
      if (card) card.classList.toggle('is-included', on);
    });
  }

  /* The customer sees one number and only on the final step: no running total
     while picking, no line-by-line breakdown. The itemised list still goes to
     n8n, so the office knows what the quote is made of.

     The hourly branch is the deliberate exception: its total is on the same
     screen as its two inputs, because there the sum *is* the offer and there is
     no later step to hold it back for. Both branches render on every change -
     only one of them is on screen, and keeping them in step costs nothing. */
  function render() {
    syncPack();
    summaryTotal.textContent = '€' + total(lines(read()));
    summaryBonus.hidden = !bonusTaken;

    var h = readHourly();
    hourlyLine.textContent = h.cleaners + (h.cleaners === 1 ? ' cleaner' : ' cleaners') +
      ' × ' + h.hours + ' hours × €' + HOURLY_RATE;
    hourlyTotal.textContent = '€' + total(hourlyLines(h));
  }

  form.addEventListener('change', render);
  form.addEventListener('input', function (e) {
    if (e.target.classList.contains('counter__value')) render();
  });

  /* ------------------------------------------------------------ counters */

  form.addEventListener('click', function (e) {
    var btn = e.target.closest('.counter__btn');
    if (!btn) return;

    var input = form.elements[btn.dataset.count];
    var min = parseInt(input.min, 10) || 0;
    var max = parseInt(input.max, 10) || 99;
    var next = (parseInt(input.value, 10) || 0) + parseInt(btn.dataset.delta, 10);

    input.value = Math.min(max, Math.max(min, next));
    render();
  });

  /* A hand-typed number is allowed to sit outside min/max while it is still
     being typed - rewriting it on every keystroke would fight anyone entering
     "12" one digit at a time. Once the field is left, though, what it shows has
     to be what is being quoted. num() clamps for the maths either way; this
     just makes the input agree with it, which matters most for the three-hour
     minimum, where the gap would otherwise be a visible contradiction. */
  ['cleaners', 'hours'].forEach(function (name) {
    var el = form.elements[name];
    if (!el) return;
    el.addEventListener('change', function () {
      el.value = String(num(name, parseInt(el.min, 10) || 0));
      render();
    });
  });

  /* --------------------------------------------------------------- steps */

  var modal = document.getElementById('calcModal');
  var panels = Array.prototype.slice.call(form.querySelectorAll('.calc__panel'));
  var progress = Array.prototype.slice.call(document.querySelectorAll('#calcProgress li'));
  var seenPrice = false;            // true once the quote step has been reached

  function show(step, scroll) {
    if (String(step) === '4') seenPrice = true;
    panels.forEach(function (panel) {
      var match = panel.dataset.panel === String(step);
      panel.hidden = !match;
      panel.classList.toggle('is-active', match);
    });

    progress.forEach(function (item) {
      var n = Number(item.dataset.step);
      item.classList.toggle('is-current', n === Number(step));
      item.classList.toggle('is-done', n < Number(step));
    });

    // a long step can leave the panel scrolled halfway down — start each one at the top
    if (scroll) form.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-go]');
    if (!btn) return;
    show(btn.dataset.go, true);
  });

  /* ----------------------------------------------------------------- mode

     Two branches, one dialog. "rooms" is the four-step wizard; "hourly" is a
     single panel that prices people and time. They share the dialog shell, the
     lead form, the validation and the sending code, and differ in exactly three
     places: which panel is on screen, which heading is above it, and which of
     lines()/hourlyLines() builds the quote. */

  var progressList = document.getElementById('calcProgress');
  var heads = Array.prototype.slice.call(modal.querySelectorAll('[data-head]'));
  var leadBlock = modal.querySelector('.lead');
  var leadSlots = {
    rooms: document.getElementById('leadSlotRooms'),
    hourly: document.getElementById('leadSlotHourly')
  };
  var mode = 'rooms';

  function setMode(next, scroll) {
    mode = next === 'hourly' ? 'hourly' : 'rooms';

    progressList.hidden = mode === 'hourly';    // a single screen has no steps to track
    heads.forEach(function (h) { h.hidden = h.dataset.head !== mode; });
    // the dialog's label has to follow the visible heading rather than point at
    // a hidden one
    modal.setAttribute('aria-labelledby', mode === 'hourly' ? 'calcHourlyTitle' : 'calcModalTitle');

    // moved, not cloned: one form, one set of ids, one validation path
    leadSlots[mode].appendChild(leadBlock);

    show(mode === 'hourly' ? 'hourly' : 1, scroll);
  }

  form.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mode]');
    if (!btn) return;
    setMode(btn.dataset.mode, true);
  });

  /* --------------------------------------------------------------- dialog */

  var lastTrigger = null;

  function openModal(trigger) {
    lastTrigger = trigger || null;

    // a finished quote should not be the first thing the next visitor sees
    if (!document.querySelector('.calc__done').hidden) {
      form.reset();
      resetSubmit();
      bonusTaken = false;          // the gift belonged to the order just sent
      seenPrice = false;
      render();
    }
    // `data-open-calc="hourly"` on the Services card's button drops the visitor
    // straight into the hourly branch; every other opener carries a bare
    // attribute and lands on the wizard
    setMode(trigger ? trigger.getAttribute('data-open-calc') : 'rooms', false);

    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');       // very old browsers: plain block

    document.body.classList.add('is-locked');
    form.scrollTop = 0;
  }

  // idempotent: the dialog can be closed by us, by Esc or by the backdrop
  function afterClose() {
    document.body.classList.remove('is-locked');
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }

  function closeModal() {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
    afterClose();
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open-calc]');
    if (opener) {
      e.preventDefault();
      openModal(opener);
      return;
    }
    if (e.target.closest('[data-close-calc]')) requestClose();
  });

  /* Closing on a backdrop click needs two guards, and both are load-bearing:

     1. the press must land on the dialog element itself, not on a child — a
        click on "Continue" is a click inside, wherever it happens to be;
     2. the coordinates must be outside the panel, measured on pointerdown.
        The dialog is vertically centred, so switching a step changes its height
        and moves the box; measuring during the click (after the step already
        switched) put the button's own coordinates outside the new rect and
        closed the calculator on Continue.
     Testing only `e.target === dialog` is not enough either: the dialog has its
     own padding, and a click on that empty strip is inside the panel. */
  function pressedOutside(dialog, e) {
    if (e.target !== dialog) return false;
    var r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right ||
           e.clientY < r.top || e.clientY > r.bottom;
  }

  function backdropClose(dialog, onOutside) {
    var pressWasOutside = false;
    dialog.addEventListener('pointerdown', function (e) {
      pressWasOutside = pressedOutside(dialog, e);
    });
    dialog.addEventListener('click', function (e) {
      if (pressWasOutside && e.target === dialog) onOutside();
      pressWasOutside = false;
    });
  }

  backdropClose(modal, function () { requestClose(); });

  // Esc: handled here rather than left to the dialog, because the `close` event
  // is unreliable across engines and the body lock has to come off either way
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (offer.open) {              // the offer closes first, the calculator stays
      e.preventDefault();
      closeOffer();
    } else if (modal.open) {
      e.preventDefault();
      requestClose();
    }
  });

  /* ---------------------------------------------- one-time leaving offer */

  var offer = document.getElementById('offerModal');
  var offerShown = false;
  var orderSent = false;

  /* The offer only makes sense to someone who has seen the quote and is having
     second thoughts about it. Leaving on step 1-3 just closes the calculator.
     It is also skipped in the hourly branch: the gift is three inside windows,
     which is a room-by-room add-on and would be a non sequitur against a
     booking measured in cleaner-hours. */
  function requestClose() {
    if (mode === 'rooms' && seenPrice && !orderSent && !bonusTaken && !offerShown &&
        typeof offer.showModal === 'function') {
      offerShown = true;
      offer.showModal();
      return;
    }
    closeModal();
  }

  function closeOffer() {
    if (typeof offer.close === 'function') offer.close();
    else offer.removeAttribute('open');
  }

  backdropClose(offer, closeOffer);

  document.getElementById('offerAccept').addEventListener('click', function () {
    bonusTaken = true;
    form.elements.winInside.value = String(Math.max(read().winInside, BONUS_WINDOWS));
    render();
    closeOffer();
    show(4, true);                 // land on the quote so the gift is visible
  });

  document.getElementById('offerDecline').addEventListener('click', function () {
    closeOffer();
    closeModal();
  });

  modal.addEventListener('close', afterClose);

  // The calculator only ever opens from a click. It used to auto-open on the
  // #calculator hash, which made it ambush anyone arriving on that URL.
  if (modal.open) closeModal();

  /* ---------------------------------------------------------- validation */

  function setError(field, errorEl, message) {
    field.classList.toggle('has-error', !!message);
    errorEl.hidden = !message;
    if (message) errorEl.textContent = message;
  }

  var nameInput = document.getElementById('leadName');
  var phoneInput = document.getElementById('leadPhone');
  var errName = document.getElementById('errName');
  var errPhone = document.getElementById('errPhone');

  function validName() {
    var ok = nameInput.value.trim().length >= 2;
    setError(nameInput.closest('.field'), errName, ok ? '' : 'Please tell us your name.');
    return ok;
  }

  function validPhone() {
    // Irish numbers: 08x 123 4567, 01 234 5678, or the same with +353 / 00353
    var digits = phoneInput.value.replace(/[\s()\-.]/g, '');
    var ok = /^(\+353|00353|0)\d{7,10}$/.test(digits);
    setError(phoneInput.closest('.field'), errPhone,
      ok ? '' : 'Please enter an Irish number, e.g. 087 123 4567.');
    return ok;
  }

  nameInput.addEventListener('blur', validName);
  phoneInput.addEventListener('blur', validPhone);

  /* ------------------------------------------------------------- sending */

  function orderText(s, items, sum, name, phone) {
    var extras = s.extras.map(function (k) { return EXTRAS[k].label; }).join(', ') || 'none';
    var windows = s.winInside + ' inside, ' + s.winOutside + ' outside, ' + s.frames + ' frames';

    var rows = [
      '🆕 NEW REQUEST FROM WEBSITE',
      '',
      '👤 Client: ' + name,
      '📞 Phone: ' + phone,
      '',
      '🧹 Cleaning type: ' + TYPE_LABEL[s.type],
      '🏠 Rooms: ' + plural(s.bedrooms, 'bedroom') + ', ' + plural(s.bathrooms, 'bathroom') + ' (kitchen + living room included)',
      '➕ Extras: ' + extras,
      '🪟 Windows: ' + windows
    ];

    /* Three of those extras are the package rather than separate buys, so the
       office would otherwise add the list up and find it €15 short of the quote. */
    if (s.type === 'deepplus') {
      rows.push('📦 Deep Plus package: fridge, microwave and kitchen cabinets included (−€' + PACK.saving + ')');
    }

    if (bonusTaken) {
      rows.push('🎁 Bonus applied: ' + BONUS_WINDOWS + ' inside windows free (−€' + WINDOWS.inside[BONUS_WINDOWS] + ')');
    }

    rows.push('', '💳 Quote: €' + sum, '', '⏰ ' + new Date().toLocaleString('en-IE'));
    return rows.join('\n');
  }

  function hourlyOrderText(s, sum, name, phone) {
    return [
      '🆕 NEW REQUEST FROM WEBSITE',
      '⏱ Cleaners by the hour',
      '',
      '👤 Client: ' + name,
      '📞 Phone: ' + phone,
      '',
      '👥 Cleaners: ' + s.cleaners,
      '🕒 Hours: ' + s.hours + ' (minimum ' + HOURLY_MIN_HOURS + ')',
      '💶 Rate: €' + HOURLY_RATE + ' per hour, per cleaner',
      '',
      '💳 Quote: €' + sum,
      '',
      '⏰ ' + new Date().toLocaleString('en-IE')
    ].join('\n');
  }

  /* ------------------------------------------------------ lead delivery */

  /* One exit for both branches. n8n answers with whatever the workflow
     returns, and a workflow that ends without a Respond node replies with an
     empty body, so success is judged on the HTTP status alone - parsing the
     reply would turn a delivered lead into a visible error for the client. */
  function sendLeadToN8n(data) {
    return fetch(N8N_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('n8n responded ' + res.status);
      return res;
    });
  }

  /* These strings are read by a person, in a spreadsheet row, next to a price.
     "1 bedrooms" there is the kind of thing that makes someone doubt the rest
     of the number, so the count and the word agree. */
  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  /* The office needs the same facts it used to read off the Telegram message,
     but as named fields rather than one blob, so the workflow can route, store
     and answer on them. The full human-readable order stays in `message`, so
     nothing is lost if a field is ever added here and not there. */
  function leadPayload(state, items, sum, name, phone) {
    var hourly = mode === 'hourly';
    var service, details;

    if (hourly) {
      service = 'Cleaners by the hour';
      details = plural(state.cleaners, 'cleaner') + ', ' +
                plural(state.hours, 'hour') + ' at €' +
                HOURLY_RATE + ' per hour per cleaner';
    } else {
      var extraLabels = state.extras.map(function (k) { return EXTRAS[k].label; });
      service = [TYPE_LABEL[state.type]].concat(extraLabels).join(' + ');
      details = plural(state.bedrooms, 'bedroom') + ', ' +
                plural(state.bathrooms, 'bathroom') +
                ', kitchen and living room included; windows: ' +
                state.winInside + ' inside, ' + state.winOutside + ' outside, ' +
                plural(state.frames, 'frame');
    }

    var message = hourly ? hourlyOrderText(state, sum, name, phone)
                         : orderText(state, items, sum, name, phone);

    // the free windows are only ever offered by the leaving popup, so taking
    // them is also the record that the lead came back from it
    if (bonusTaken) {
      message += '\n\nCame back through the exit offer (' + BONUS_WINDOWS +
                 ' inside windows free)';
    }

    return {
      name: name,
      phone: phone,
      email: '',                 // this form asks for a name and a phone only
      service: service,
      property_details: details,
      estimated_price: sum,
      message: message,
      source: window.trafficSource || 'website'
    };
  }

  function trackLead(value) {
    // wired up together with the Meta Pixel / GA4 at launch
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { value: value, currency: 'EUR', content_name: 'Cleaning quote' });
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { value: value, currency: 'EUR' });
    }
  }

  var submitBtn = document.getElementById('calcSubmit');
  var fallback = document.getElementById('leadFallback');
  var doneLine = document.getElementById('doneLine');
  var SUBMIT_LABEL = submitBtn.innerHTML;

  function resetSubmit() {
    submitBtn.disabled = false;
    submitBtn.innerHTML = SUBMIT_LABEL;
    fallback.hidden = true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var okName = validName();
    var okPhone = validPhone();
    if (!okName || !okPhone) {
      (okName ? phoneInput : nameInput).focus();
      return;
    }

    var hourly = mode === 'hourly';
    var state = hourly ? readHourly() : read();
    var items = hourly ? hourlyLines(state) : lines(state);
    var sum = total(items);
    var name = nameInput.value.trim();
    var phone = phoneInput.value.trim();

    fallback.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    sendLeadToN8n(leadPayload(state, items, sum, name, phone))
      .then(function () {
        orderSent = true;          // no leaving-offer once the request is in
        trackLead(sum);
        doneLine.textContent = name + ', we will call you back on ' + phone +
          ' shortly to confirm the €' + sum + ' quote and the time';
        show('done', true);
      })
      .catch(function (err) {
        // never swallow the lead: show the direct channels instead of an error
        console.error('Lead delivery failed:', err);
        fallback.hidden = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Try again <span class="btn__arrow" aria-hidden="true">→</span>';
      });
  });

  /* ---------------------------------------------------------------- init */

  render();
})();
