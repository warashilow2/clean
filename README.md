# Eco Spark Cleaning

Static one-page site for Eco Spark Cleaning, Dublin. No build step and no
dependencies: plain HTML, CSS custom properties and vanilla JS, so whatever is
in this repo is exactly what gets served.

## Looking at it locally

Open `index.html` in a browser. Every path is relative, so it works straight
from the file system - the only thing that needs a server is seeking inside the
hero videos, which uses HTTP range requests.

For a real server, from the parent folder:

```
node serve.js
```

## Publishing

GitHub Pages serves this repo as-is from the default branch, root folder.
`.nojekyll` is there to stop Pages running the files through Jekyll.

## Before this goes live on the real domain

- Requests go to an n8n webhook (`N8N_ENDPOINT` in `assets/js/calculator.js`).
  Nothing secret is in the client any more, but the endpoint is open to anyone
  who reads the source, so the workflow should expect junk and rate-limit.
- `openingHours` is deliberately absent from the structured data until the real
  hours are confirmed.
- `privacy.html` is the privacy notice. Its retention periods and the list of
  processors are the parts to confirm with the owner before launch.
- `assets/js/consent.js` holds the cookie bar, Google Consent Mode v2 and the
  Meta pixel. GA4 and Meta are live; nothing from either is fetched until the
  visitor accepts, and declining leaves the page making no third-party request
  at all. The cookie names in privacy.html are the ones these actually set, so
  changing a vendor means changing that section too.
- `CNAME` points the GitHub Pages deployment at ecospark.ie. Deleting it
  unsets the custom domain, so it has to travel with every upload.
