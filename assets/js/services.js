/* Eco Spark Cleaning - service detail dialog

   Six cards, one dialog. Each card owns its own description: the heading,
   price and body of the dialog are read straight off the card that opened it,
   so a service's text lives in exactly one place in the markup and nothing here
   has to be kept in sync with it. */
(function () {
  'use strict';

  var modal = document.getElementById('svcModal');
  var grid = document.querySelector('.svc-grid');
  if (!modal || !grid) return;

  var elKind  = document.getElementById('svcModalKind');
  var elTitle = document.getElementById('svcModalTitle');
  var elPrice = document.getElementById('svcModalPrice');
  var elBody  = document.getElementById('svcModalBody');
  var ctas = Array.prototype.slice.call(modal.querySelectorAll('.svc-modal__cta'));

  var lastTrigger = null;

  function open(card, trigger) {
    var detail = card.querySelector('.svc__detail');
    if (!detail) return;

    lastTrigger = trigger || null;

    elKind.textContent  = card.getAttribute('data-kind') || '';
    elTitle.textContent = card.querySelector('.svc__open').textContent.trim();
    /* Copied as nodes, not flattened to text: a price can carry markup of its
       own - Deep Plus has a struck "was" figure with a screen-reader word in
       front of it - and textContent would print that word on the page. */
    elPrice.textContent = '';
    Array.prototype.forEach.call(card.querySelector('.svc__price').childNodes, function (n) {
      elPrice.appendChild(n.cloneNode(true));
    });

    // A clone, not the node itself: the original stays in the card, where it is
    // still part of the page for anything reading the markup rather than
    // clicking it. The children are moved out of the clone rather than the
    // clone appended whole, so the hidden .svc__detail wrapper does not come
    // along and take its display:none with it. Nothing inside carries an id, so
    // the copy is harmless.
    elBody.textContent = '';
    var copy = detail.cloneNode(true);
    while (copy.firstChild) elBody.appendChild(copy.firstChild);

    // Three ways out, one per kind of service: the room-by-room packages go to
    // the calculator's wizard, hourly work goes to the calculator's own hourly
    // branch, and Regular - the only one the calculator cannot price at all -
    // goes to the phone.
    var want = card.getAttribute('data-quote') || 'calc';
    ctas.forEach(function (el) { el.hidden = el.getAttribute('data-cta') !== want; });

    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');

    document.body.classList.add('is-locked');
    elBody.scrollTop = 0;
  }

  // idempotent: Esc, the backdrop and the close button all land here
  function close() {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
    document.body.classList.remove('is-locked');
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  }

  grid.addEventListener('click', function (e) {
    var trigger = e.target.closest('.svc__open');
    if (!trigger) return;
    e.preventDefault();
    open(trigger.closest('.svc'), trigger);
  });

  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-svc]')) { close(); return; }

    // "Get my price" hands over to the calculator. This listener is on the
    // dialog, so it runs before calculator.js's document-level one and the
    // service dialog is already gone by the time the calculator opens - two
    // dialogs in the top layer at once would leave this one stranded behind it.
    if (e.target.closest('[data-open-calc]')) close();
  });

  /* Backdrop close, same two guards as the calculator: the press has to land on
     the dialog element itself rather than a child, and its coordinates have to
     be outside the panel - the dialog has padding of its own, and a click on
     that strip is a click inside. Measured on pointerdown, before anything can
     move. */
  var pressWasOutside = false;
  modal.addEventListener('pointerdown', function (e) {
    if (e.target !== modal) { pressWasOutside = false; return; }
    var r = modal.getBoundingClientRect();
    pressWasOutside = e.clientX < r.left || e.clientX > r.right ||
                      e.clientY < r.top  || e.clientY > r.bottom;
  });
  modal.addEventListener('click', function (e) {
    if (pressWasOutside && e.target === modal) close();
    pressWasOutside = false;
  });

  // Esc is handled here rather than left to the dialog's own close event, which
  // is unreliable across engines - and the body lock has to come off either way
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.open) {
      e.preventDefault();
      close();
    }
  });
})();
