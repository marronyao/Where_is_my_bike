# Where is my bike?

A mobile-friendly, British English parking notebook for multiple bicycles. Static HTML, CSS and JavaScript; no build step required. Optional cloud accounts use Cloudflare Workers + D1.

## Run locally

With Node.js installed, run `node server.mjs` from this folder, then open http://127.0.0.1:4173. Geolocation requires localhost or HTTPS. Opening index.html directly is not supported for PWA features.

## Use

Add and customise bikes. Choose a bike, use your location, tap the map, drag the selected marker, or enter coordinates. Press **Save parking spot** to record the coordinates, current time and note. Each bike retains its most recent saved spot. Get directions opens Google Maps walking navigation. No continuous or background tracking occurs.

Export and import private JSON backups to transfer data manually between devices. Import replaces existing data after confirmation. localStorage is specific to browser, profile and origin; clearing site data or private browsing can remove it. It is not encrypted. Do not put backups or real coordinates in this repository. The development server serves only public application files.

## GitHub Pages

Create a GitHub repository and push these source files to its `main` branch. Under **Settings → Pages → Build and deployment**, choose **GitHub Actions**. The included workflow stages only public assets. All asset paths and service worker scope are relative, so repository subpaths work. The live repository is https://github.com/marronyao/Where_is_my_bike and the Pages site is https://marronyao.github.io/Where_is_my_bike/.

## PWA and map limitations

After the first successful visit, the service worker caches the local app shell. Browser installation support varies; use the browser’s Install/Add to Home Screen option where available. Leaflet, fonts, tiles and navigation need a network connection; manual coordinate entry and existing records remain available offline. The app falls back to system fonts. No offline map downloads or tile prefetching are performed. Standard browser HTTP caching handles tiles. Keep OpenStreetMap attribution visible and review https://operations.osmfoundation.org/policies/tiles/ before increasing usage. Leaflet 1.9.4 is loaded from unpkg; map providers and CDN services receive normal network request metadata. Map tiles reveal viewed areas, and external directions reveal the destination.

## Direct file preview and map access

Do not double-click index.html for normal use. A file:// page cannot provide the website HTTP Referer required by the standard OpenStreetMap tile service, which may return a 403 access-blocked image. File preview now pauses tile requests and explains how to start the local server. Run `node server.mjs`, then open http://127.0.0.1:4173. GitHub Pages HTTPS also provides a website origin. Browser privacy tools that strip referrers or network restrictions may still prevent tile access.

Before switching from file:// to localhost or Pages, export any existing bike records and import the backup at the new address: each origin has separate storage. The interface uses a dark night-ride palette; only the tile image layer is colour-adjusted, leaving markers and attribution readable.

## Cloud accounts

Logins are remembered in the same browser. Existing tab sessions migrate automatically when possible. Temporary network failures preserve login credentials for retry; expired/revoked sessions are cleared after a server 401. Logout is reflected in other open tabs. Clearing browser site data or using private browsing can remove the remembered login.

Sign up with a username and a password of at least 8 Unicode characters. There are no character-composition requirements. Usernames are trimmed, case-insensitive and limited to 80 characters. Passwords are not trimmed. There is currently no password reset/recovery, so keep your password safe.

The Workers API stores salted PBKDF2-SHA256 password hashes (100,000 iterations, compatible with Workers Web Crypto), hashes opaque 256-bit session tokens before storage, expires sessions after 30 days of inactivity (renewed at most once a day), revokes the current session on logout, rate-limits authentication by IP and username, and validates all incoming bike records. Browser session tokens use localStorage, so closing and reopening the browser preserves login; logout clears both persistent and legacy tab storage; cloud bike records stay in memory, rather than localStorage. The service worker caches public shell files only. The browser has no Cloudflare API token or database credentials.

Cloud records belong to the authenticated user. Updates use a revision check; a stale device must reload cloud data rather than silently overwrite newer data. Offline cloud edits are not queued: failed saves leave the saved state unchanged and display an error. Local mode is separate and remains usable without login. Export local data before logging in, then explicitly import into the cloud account if desired. Import replaces the account document after confirmation and uploads exact coordinates.

Backend source: backend/worker.mjs; schema: backend/schema.sql; deployment config: backend/wrangler.jsonc. The database/account IDs in configuration are identifiers, not credentials. Run wrangler d1 execute where-is-my-bike --remote --file backend/schema.sql --config backend/wrangler.jsonc followed by wrangler deploy --config backend/wrangler.jsonc after signing in to the appropriate Cloudflare account. config.js contains only the public API endpoint. The API allows the Pages origin https://marronyao.github.io; local preview can use guest mode, or a separate development backend with a localhost allowed origin.

Tests: node tests/frontend.mjs checks account transitions and failure handling. node tests/cloud-smoke.mjs tests the deployed API with disposable accounts; it writes their IDs to ignored private/test-users.json for cleanup. Never commit private/ or backups.
