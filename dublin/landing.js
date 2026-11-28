/* Eco Spark Cleaning - /dublin/ and /dublin/quote/
   Burger menu, the "what's included" columns, the service preselect and the
   quote form. No library, no build step. Both pages load this file; every
   block below starts by checking that its own markup is on the page. */
(function () {
  'use strict';

  /* One place for the facts that appear on both pages and in the message the
     office reads. If a number changes it changes here and in the two HTML
     files - grep for it, do not trust memory. */
  var SITE = {
    phone:    '01 265 8205',
    tel:      'tel:+35312658205',
    whatsapp: 'https://wa.me/35312658205',
    hours:    '8am to 11pm, every day'
  };

  /* The same endpoint and the same transport as the calculator on the home
     page. 'text/plain' IS DELIBERATE and must stay: with 'application/json'
     the browser treats this as a non-simple request and sends a CORS
     preflight first, and an Apps Script web app does not answer OPTIONS - the
     lead would never leave the page. The body is still JSON and the script
     still parses it as JSON; what the body contains and what the header
     claims are two different things. */
  var LEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzWM7K27549gcjYhWxvtBb2uVwrxIcehnhSD95ZHoqqBO-6Jrx5AJ2js_hLs4ybiOsE/exec';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ----------------------------------------------- where the visit came from

     The office gets a row in a spreadsheet saying someone wants a quote, and
     until now every row said the same thing: "website". Which advert, which
     keyword, which campaign - gone. These are the parameters Google, Bing and
     Meta hang on the click, and they arrive on the FIRST page only.

     They are carried to the quote page by rewriting the links, NOT by storing
     them. Storage on the visitor's device is exactly what the cookie bar is
     about, and campaign attribution is not "strictly necessary", so writing
     it to sessionStorage before anyone has answered the bar would make the
     privacy page wrong. A query string travels with the click and disappears
     with the tab. */
  var TRACK_KEYS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid',
                    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  var params = new URLSearchParams(window.location.search);
  var traffic = {};
  TRACK_KEYS.forEach(function (k) {
    var v = params.get(k);
    if (v) traffic[k] = v.slice(0, 120);   // a click id is ~90 chars; junk is not
  });

  /* Short enough for a spreadsheet column, specific enough to act on. */
  function trafficLabel() {
    if (traffic.gclid || traffic.gbraid || traffic.wbraid) return 'Google Ads';
    if (traffic.msclkid) return 'Bing Ads';
    if (traffic.fbclid) return 'Facebook';
    if (traffic.utm_source) {
      return traffic.utm_source + (traffic.utm_medium ? ' / ' + traffic.utm_medium : '');
    }
    if (document.referrer) {
      try {
        var h = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (h && h !== window.location.hostname) return h;
      } catch (e) {}
    }
    return 'direct';
  }

  /* The campaign name is the part a person can act on: it says which advert
     paid for this call. The click id stays out of the message - it is 90
     characters of machine code and the office does not bid on it. */
  function campaignNote() {
    var bits = [];
    if (traffic.utm_campaign) bits.push('campaign: ' + traffic.utm_campaign);
    if (traffic.utm_term) bits.push('keyword: ' + traffic.utm_term);
    if (traffic.utm_content) bits.push('ad: ' + traffic.utm_content);
    return bits.length ? '. ' + bits.join(', ') : '';
  }

  /* The landing page and the form are two pages, so the parameters have to
     survive one click. Every link into the quote page gets them. */
  (function carryToQuote() {
    var keys = Object.keys(traffic);
    if (!keys.length) return;
    $$('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || !/(^|\/)quote\/|^\.\/\?service=/.test(href)) return;
      var url = new URL(href, window.location.href);
      keys.forEach(function (k) { if (!url.searchParams.has(k)) url.searchParams.set(k, traffic[k]); });
      a.setAttribute('href', url.pathname + url.search);
    });
  })();

  /* ------------------------------------------------------- burger menu */

  var burger = $('#burger');
  var menu = $('#menu');

  if (burger && menu) {
    var setMenu = function (open) {
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    burger.addEventListener('click', function () {
      setMenu(!menu.classList.contains('is-open'));
    });

    // closing on a link keeps the menu from covering the section it just
    // scrolled to
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    // the desktop layout has its own nav, so a menu left open while the
    // window grows would hang around with nothing to close it
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) setMenu(false);
    });
  }

  /* --------------------------------------------- what's included columns

     The four lists are <details> so that a phone gets a real accordion with
     the first one open. On a wide screen they are four plain columns, and
     CSS cannot force a <details> open, so this does it - and then swallows
     the clicks, because a column that collapses when you tap its heading is
     a column that looks broken. */

  var inc = $('#included');

  if (inc) {
    var panels = $$('details', inc);
    var wide = window.matchMedia('(min-width:900px)');

    var layout = function () {
      panels.forEach(function (d, i) {
        d.open = wide.matches ? true : i === 0;
      });
    };

    layout();
    if (wide.addEventListener) wide.addEventListener('change', layout);
    else if (wide.addListener) wide.addListener(layout);

    inc.addEventListener('click', function (e) {
      if (wide.matches && e.target.closest('summary')) e.preventDefault();
    });
  }

  /* -------------------------------------------------------- quote form */

  var form = $('#quoteForm');
  if (!form) return;

  var box     = $('#quoteBox');

  /* The dock sits over the bottom right corner, which on a phone is also
     where the fields and the send button end. A 56px circle there eats the
     tap this whole page exists for, so it steps aside while the form is on
     screen. The box, not the form: the form is replaced by the thank-you
     panel on success, and the observer would be left watching a node that is
     no longer in the document. It starts visible and stays visible if this
     never runs. */
  var dock = $('.dock');
  if (window.IntersectionObserver && dock && box) {
    new IntersectionObserver(function (entries) {
      dock.hidden = entries[0].isIntersecting;
    }, { threshold: 0.25 }).observe(box);
  }

  var send    = $('#qSend');
  var nameEl  = $('#qName');
  var phoneEl = $('#qPhone');
  var svcEl   = $('#qService');
  var msgEl   = $('#qMessage');
  var nameNote  = $('#qNameNote');
  var phoneNote = $('#qPhoneNote');
  var PHONE_HINT = phoneNote.textContent;

  /* The service the visitor picked on the landing page travels in the query
     string. Only a value the <select> actually has is accepted - anything
     else is someone else's link, and a silent mismatch would put the wrong
     job in front of the office. */
  var wanted = params.get('service');
  if (wanted && $('option[value="' + CSS.escape(wanted) + '"]', svcEl)) svcEl.value = wanted;

  function note(el, text, bad) {
    el.textContent = text;
    if (bad) el.setAttribute('data-error', '1');
    else el.removeAttribute('data-error');
  }

  function digits(s) { return (s.match(/\d/g) || []).length; }

  function checkName(show) {
    var ok = nameEl.value.trim().length >= 2;
    nameEl.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (show) note(nameNote, ok ? '' : 'Please tell us your name', !ok);
    return ok;
  }

  function checkPhone(show) {
    var ok = digits(phoneEl.value) >= 7;
    phoneEl.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (show) note(phoneNote, ok ? PHONE_HINT : 'Please enter a phone number we can ring', !ok);
    return ok;
  }

  nameEl.addEventListener('input', function () { if (nameEl.value.trim().length >= 2) checkName(true); });
  phoneEl.addEventListener('input', function () { if (digits(phoneEl.value) >= 7) checkPhone(true); });

  /* The office reads this in a spreadsheet row and in a Telegram message, in
     the same shape the calculator sends, so the one Apps Script route, the
     one sheet and the bot's buttons keep working without a change on that
     side. The fields this page cannot know go out empty rather than guessed:
     there is no price here, because the page quotes nobody. */
  function payload() {
    var serviceText = svcEl.options[svcEl.selectedIndex].text;
    var extra = msgEl.value.trim();
    return {
      name: nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      email: '',
      service: serviceText,
      property_details: '',
      estimated_price: '',
      message: 'Landing /dublin - call back with a quote. Service: ' + serviceText +
               (extra ? '. Note: ' + extra : '') + campaignNote(),
      source: trafficLabel() + ' / landing-dublin'
    };
  }

  function thanks(name, phone) {
    box.innerHTML =
      '<h2>Thanks, ' + esc(name) + '!</h2>' +
      "<p>We'll call you on " + esc(phone) + ' within the hour.</p>' +
      "<p>We'll call you shortly from 01 265 8205 (Eco Spark Cleaning) - please pick up!</p>" +
      '<div class="done__row">' +
        '<a class="btn-outline" href="../../assets/eco-spark-cleaning.vcf" download>Save our number</a>' +
        '<a class="btn-outline" href="../">Back to the main page</a>' +
      '</div>';
    box.setAttribute('tabindex', '-1');
    box.scrollIntoView({ block: 'center' });
    box.focus({ preventScroll: true });
  }

  /* Never swallow the lead: if the request failed, the two channels that do
     not depend on our code go in front of the person, full size, and nothing
     they typed is cleared. */
  var failBox = null;

  function failed() {
    if (!failBox) {
      failBox = document.createElement('div');
      failBox.className = 'fail';
      failBox.setAttribute('role', 'alert');
      failBox.innerHTML =
        "Sorry, we couldn't send that. Please call or WhatsApp us - we answer every day, 8am to 11pm." +
        '<div class="row">' +
          '<a class="btn" href="' + SITE.tel + '">Call ' + SITE.phone + '</a>' +
          '<a class="btn-outline" href="' + SITE.whatsapp + '" target="_blank" rel="noopener">WhatsApp</a>' +
        '</div>';
      send.parentNode.insertBefore(failBox, send);
    }
    send.disabled = false;
    send.textContent = 'Get my free quote';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var okName = checkName(true);
    var okPhone = checkPhone(true);
    if (!okName || !okPhone) { (okName ? phoneEl : nameEl).focus(); return; }

    var name = nameEl.value.trim();
    var phone = phoneEl.value.trim();

    send.disabled = true;
    send.textContent = 'Sending…';

    fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload())
    }).then(function (res) {
      if (!res.ok) throw new Error('lead endpoint ' + res.status);
      /* Reported only once the endpoint has accepted it. A conversion counted
         for a lead that never arrived is worse than a missing one: the
         campaign then goes looking for more of the same. No value is sent,
         because this page never puts a price on anything. */
      if (window.esTrack) window.esTrack('lead');
      thanks(name, phone);
    }).catch(function (err) {
      console.error('Lead delivery failed:', err);
      failed();
    });
  });
})();
