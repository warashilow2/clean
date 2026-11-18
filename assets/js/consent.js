/* Eco Spark Cleaning - cookie consent and Google Consent Mode v2

   LIVE SINCE 21.10.2026. Until then this did nothing and showed nothing,
   because the site set no cookies and loaded nothing from anyone else - and a
   banner asking permission for something that is not happening is worse than
   no banner: it contradicts the privacy page and teaches people to click past
   the box without reading, which is what makes a real one worthless.

   The owner asked for analytics from the first day on the new site, so GA4 and
   the Meta pixel are now configured and the bar appears. The Irish ePrivacy
   Regulations (S.I. 336/2011, reg. 5) require consent before anything is
   stored on or read from the visitor's device, and that is what this is for.

   WHAT HAPPENS NOW, in order:

     - Consent Mode v2 defaults are set to denied before anything loads;
     - the bar appears, with Accept and Decline the same size (the Data
       Protection Commission treats a prominent Accept beside a quiet Decline
       as consent that was not freely given);
     - nothing from Google loads until someone presses Accept;
     - the choice is remembered, and the "Cookies" link in the footer appears
       so it can be changed later - withdrawing has to be as easy as giving;
     - the Cookies section of privacy.html lists, by name, every cookie each
       vendor sets and how long it lasts. **Change the vendors here and that
       table is wrong** - they are one change, not two.

   Emptying every id in ANALYTICS puts the whole thing back to sleep: no bar,
   no requests, nothing stored. ?consent=preview shows the bar regardless.
*/
(function () {
  'use strict';

  /* Live since 21.10.2026. The GA4 and Meta ids are the ones the previous site
     used, so the history in those accounts carries on rather than restarting.
     Empty any of them and that vendor simply never loads; empty all three and
     the bar stops appearing, because then there is nothing to consent to. */
  var ANALYTICS = {
    ga4:  'G-EGYSK3HKDK',      // Google Analytics 4
    ads:  'AW-18388700942',    // Google Ads conversions, live since 17.11.2026
    meta: '892305780520567'    // Meta pixel
  };

  /* What counts as a conversion, and what each vendor calls it. All three
     vendors are named here rather than at the call sites, for the same reason
     the ids are: changing one of them should be one edit in one file.

     `ads` is the half of the Google Ads label that comes after the slash. Ads
     hands the pair out as 'AW-18388700942/zBdsCO_bxpIdEI6etcBE'; the account
     part already lives above, and one id in two places is one id too many.

     TWO THINGS ABOUT THE ADS LABELS, both worth knowing before adding more.

     Google sent two labels on 17.11.2026, for actions named "Контакты" and
     "Контакты (1)" - which reads like the same action created twice. Only one
     is wired. Firing both on a single submitted form would count every lead
     twice, and a campaign optimising on a doubled number bids as though leads
     cost half what they do. If the second really is a duplicate, delete it in
     Ads rather than finding a use for it here.

     Google's instructions put these snippets in <head> as "conversion page"
     tags. That is for sites with a separate /thank-you URL. This site is one
     page and the thank-you screen is a dialog, so pasting them there would
     have reported a conversion for every visitor who merely opened the site -
     including the ones who left in three seconds. They fire from real actions
     instead: a quote request the webhook accepted, a tap to call, a tap to
     WhatsApp. Call and chat have no label yet because no such action exists in
     the Ads account; GA4 and Meta still record them. */
  var EVENTS = {
    lead: { ga4: 'generate_lead',    meta: 'Lead',    name: 'Cleaning quote', ads: 'zBdsCO_bxpIdEI6etcBE' },
    call: { ga4: 'contact_call',     meta: 'Contact', name: 'Phone',          ads: '' },
    chat: { ga4: 'contact_whatsapp', meta: 'Contact', name: 'WhatsApp',       ads: '' }
  };

  /* 'basic'    - Google loads only after Accept. Nothing reaches Google from a
                  visitor who declines, not even their IP address.
     'advanced' - Google loads straight away with storage denied, and sends
                  cookieless pings that let Ads model the conversions it cannot
                  see. Better numbers, more exposure.
     Basic is the default here because the brief was "no questions from the
     Irish side". Switch it only knowing what it buys. */
  var MODE = 'basic';

  var STORE_KEY = 'es-consent';     // remembering the answer is itself
                                    // strictly necessary, so it needs no consent

  var params = new URLSearchParams(window.location.search);
  var preview = params.get('consent') === 'preview';
  var live = !!(ANALYTICS.ga4 || ANALYTICS.ads || ANALYTICS.meta);

  if (!live && !preview) return;    // nothing configured: do nothing at all

  /* ------------------------------------------------------------- remembering */

  function read() {
    try { return window.localStorage.getItem(STORE_KEY); }
    catch (e) { return null; }      // private mode, blocked storage
  }

  function write(value) {
    try { window.localStorage.setItem(STORE_KEY, value); } catch (e) {}
  }

  /* ------------------------------------------------------- google consent v2 */

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  if (live) {
    // this has to run before any Google tag, which is why the file is loaded
    // in the head rather than with the other scripts at the end of the body
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
      wait_for_update: 500
    });
  }

  var tagLoaded = false;

  function loadGoogle() {
    if (tagLoaded || !live) return;
    tagLoaded = true;

    var id = ANALYTICS.ga4 || ANALYTICS.ads;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);

    gtag('js', new Date());
    if (ANALYTICS.ga4) gtag('config', ANALYTICS.ga4);
    if (ANALYTICS.ads) gtag('config', ANALYTICS.ads);
  }

  /* Meta has no equivalent of Consent Mode worth relying on: fbq('consent',
     'revoke') still loads the script from connect.facebook.net, which is
     already a request to Meta carrying the visitor's IP. So the pixel is not
     fetched at all until someone says yes - the same rule as MODE 'basic'
     above, applied to the one vendor that gives no other choice. */
  var metaLoaded = false;

  function loadMeta() {
    if (metaLoaded || !ANALYTICS.meta) return;
    metaLoaded = true;

    /* Meta's own snippet, with the queue kept and the eval-ish bits dropped. */
    var n = window.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];

    var t = document.createElement('script');
    t.async = true;
    t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(t);

    window.fbq('init', ANALYTICS.meta);
    window.fbq('track', 'PageView');
  }

  var granted = false;

  function grant() {
    if (!live) return;
    granted = true;
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
    loadGoogle();
    loadMeta();
  }

  // advanced mode loads the tag up front and lets consent mode hold the storage
  if (live && MODE === 'advanced') loadGoogle();

  /* ------------------------------------------------------------- reporting */

  /* The one way anything on the site reports anything, used by the calculator
     and by the contact links below.

     Everything is gated on `granted`, and the gate is explicit rather than
     implied. gtag() above is only a dataLayer push, so calling it before the
     tag has loaded does not fail - it queues, and the hit would then fire the
     moment someone pressed Accept, carrying the wrong time and attributed to a
     visit that had not consented when it happened.

     This also replaces the `typeof window.gtag === 'function'` checks the
     calculator used to make, which could never pass: the gtag helper here is
     local to this file, and the Google tag script does not create window.gtag
     of its own - the page is expected to. So the GA4 half of trackLead() had
     been dead since launch, while the Meta half worked, because window.fbq is
     assigned explicitly. One reporting function instead of per-vendor guards
     scattered through the modules.

     `value` is optional and only travels when it is a real positive number. */
  window.esTrack = function (action, value) {
    if (!granted) return;

    var e = EVENTS[action];
    if (!e) return;

    var money = typeof value === 'number' && isFinite(value) && value > 0;

    if (ANALYTICS.ga4) {
      gtag('event', e.ga4, money ? { value: value, currency: 'EUR' } : {});
    }

    if (ANALYTICS.meta && typeof window.fbq === 'function') {
      var m = { content_name: e.name };
      if (money) { m.value = value; m.currency = 'EUR'; }
      window.fbq('track', e.meta, m);
    }

    if (ANALYTICS.ads && e.ads) {
      var a = { send_to: ANALYTICS.ads + '/' + e.ads };
      if (money) { a.value = value; a.currency = 'EUR'; }
      gtag('event', 'conversion', a);
    }
  };

  /* Phone and WhatsApp are two of the three ways to get in touch, and on a
     phone they are the two most people actually use - counting only the form
     would credit a campaign with a fraction of what it did.

     Delegated from the document because these links appear around twenty times
     across the hero, header, menu, services, footer, dock and sticky bar;
     twenty listeners, or twenty onclick attributes, would be twenty places to
     forget. The navigation into the dialler is not delayed and not waited for:
     gtag sends with sendBeacon, which outlives it. */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="tel:"], a[href*="wa.me"]');
    if (!link) return;
    window.esTrack(link.getAttribute('href').indexOf('tel:') === 0 ? 'call' : 'chat');
  });

  /* ------------------------------------------------------------------ the bar */

  var bar = null;

  function close() {
    if (!bar) return;
    bar.remove();
    bar = null;
  }

  function decide(answer) {
    write(answer);
    if (answer === 'all') grant();
    close();
    showSettingsLink();
  }

  function build() {
    if (bar) return;

    bar = document.createElement('div');
    bar.className = 'consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookies');
    bar.innerHTML =
      '<p class="consent__text">' +
        'We use cookies to see how the site is used and to measure our ads. ' +
        'Nothing is set and nothing is sent unless you agree. ' +
        '<a href="privacy.html#cookies">What we collect</a>' +
      '</p>' +
      '<div class="consent__actions">' +
        '<button type="button" class="consent__btn" data-consent="none">Only what is needed</button>' +
        '<button type="button" class="consent__btn consent__btn--yes" data-consent="all">Accept</button>' +
      '</div>';

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (btn) decide(btn.getAttribute('data-consent'));
    });

    document.body.appendChild(bar);   // the slide-up is a keyframe in the CSS
  }

  /* The way back in. Hidden in the markup so it never appears while there is
     nothing to change, which is the same reason the bar does not appear. */
  function showSettingsLink() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cookie-settings]'), function (el) {
      el.hidden = false;
    });
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-cookie-settings]');
    if (!opener) return;
    e.preventDefault();
    build();
  });

  /* ---------------------------------------------------------------- on load */

  function start() {
    var answer = read();

    if (answer === 'all') { grant(); showSettingsLink(); return; }
    if (answer === 'none') { showSettingsLink(); return; }

    build();
    if (live) showSettingsLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
