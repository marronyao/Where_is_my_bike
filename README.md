# Where is my bike?

A mobile-friendly, British English parking notebook for multiple bicycles. Static HTML, CSS and JavaScript; no build step or account required.

## Run locally

With Node.js installed, run `node server.mjs` from this folder, then open http://127.0.0.1:4173. Geolocation requires localhost or HTTPS. Opening index.html directly is not supported for PWA features.

## Use

Add and customise bikes. Choose a bike, use your location, tap the map, drag the selected marker, or enter coordinates. Press **Save parking spot** to record the coordinates, current time and note. Each bike retains its most recent saved spot. Get directions opens Google Maps walking navigation. No continuous or background tracking occurs.

Export and import private JSON backups to transfer data manually between devices. Import replaces existing data after confirmation. localStorage is specific to browser, profile and origin; clearing site data or private browsing can remove it. It is not encrypted. Do not put backups or real coordinates in this repository. The development server serves only public application files.

## GitHub Pages

Create a GitHub repository and push these source files to its `main` branch. Under **Settings → Pages → Build and deployment**, choose **GitHub Actions**. The included workflow stages only public assets. All asset paths and service worker scope are relative, so repository subpaths work. No GitHub repository or live deployment has been created by this initial implementation.

## PWA and map limitations

After the first successful visit, the service worker caches the local app shell. Browser installation support varies; use the browser’s Install/Add to Home Screen option where available. Leaflet, fonts, tiles and navigation need a network connection; manual coordinate entry and existing records remain available offline. The app falls back to system fonts. No offline map downloads or tile prefetching are performed. Standard browser HTTP caching handles tiles. Keep OpenStreetMap attribution visible and review https://operations.osmfoundation.org/policies/tiles/ before increasing usage. Leaflet 1.9.4 is loaded from unpkg; map providers and CDN services receive normal network request metadata. Map tiles reveal viewed areas, and external directions reveal the destination.

## Optional cloud synchronisation plan

Cloud sync is not enabled in this version. Use Supabase Auth and a separate bikes table with a UUID primary key, `user_id` referencing auth.users, bike metadata, nullable coordinates, parking timestamp, note and update timestamp. Enable RLS before exposing the API. Every select/insert/update/delete policy must require `auth.uid() = user_id`; updates need both USING and WITH CHECK. Validate ranges, lengths and paired nullable coordinates with database constraints. Test with two different users plus an unauthenticated client before release.

Only the public project URL and publishable/anon key may appear in browser configuration; never include a service-role key. Offer explicit sign-in and sync opt-in, an explained local-to-cloud migration, deletion/export, sign-out that clears user-specific cached records, and visible sync/conflict errors. Keep local and per-account data separate. Use update versions or optimistic concurrency to prevent silent overwrites. Do not cache authenticated API responses in the service worker. Choose a suitable region and review the provider’s current free-tier limits and privacy terms before enabling. This static local release makes no automatic cloud requests.

## Direct file preview and map access

Do not double-click index.html for normal use. A file:// page cannot provide the website HTTP Referer required by the standard OpenStreetMap tile service, which may return a 403 access-blocked image. File preview now pauses tile requests and explains how to start the local server. Run `node server.mjs`, then open http://127.0.0.1:4173. GitHub Pages HTTPS also provides a website origin. Browser privacy tools that strip referrers or network restrictions may still prevent tile access.

Before switching from file:// to localhost or Pages, export any existing bike records and import the backup at the new address: each origin has separate storage. The interface uses a dark night-ride palette; only the tile image layer is colour-adjusted, leaving markers and attribution readable.
