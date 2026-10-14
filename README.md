truechops.com

'main' branch is set up to automatically deploy to production.

To contribute, branch off of main, and then submit a PR.

Direct commits against 'main' are rejected.

Current desired changes:

1. Playback position tracker.
2. Multiple time signatures.
3. Copy/paste
4. Exercises / Rudiments.
5. Preview saved rhythms/exercises/playlists.
6. Nested tuplets.
7. Profiles.
8. "Playlists" - link with multiple rhythms.
9. Search.
10. Infinite score when using dynamic rhythm.

## Community and MongoDB Search

The icon sidebar expands on hover or keyboard focus. Search opens the community
page at `/discover`, with live search, a compact All / Rhythms / People control,
and instrument filters below. The default All view shows People and Rhythms
together, even before searching. Old `/search` links redirect here and retain
their query, filters, and open rhythm. Search text, filters
and category are reflected in the URL; changing categories preserves the query.
All shows both result types, with independent loading and retry states.
`/profile` and `/library`
show the signed-in account's creations and privately saved community rhythms.
The profile has Rhythms and Saved tabs, plus Books & saved practice. Navigation
lives in the left sidebar; smaller screens open it with the menu button.
Public profiles use `/u/:handle`; individual rhythms use `/rhythms/:id`.
Feed cards show only exercise content. Opening a card uses a shareable `?rhythm=`
modal over the feed; Escape/Back restores the feed and keyboard focus. The modal
contains the full notation, creator, comments, likes, and library
save controls. Its Open in score action copies the score and tempo into the editor.
Use the composer's Save button to save privately or publish. Publishing requires
an explicitly created public profile. Existing saved scores remain private.

The APIs reuse the Google session cookie and account ID. Public profiles live in
`profiles`, scores remain in `rhythms`, and account-scoped bookmarks live in
`rhythmSaves`. Saved rhythms reference their original: unpublishing or deleting
a rhythm also removes it from other users' visible collections. Book ownership
and saved book practice remain accessible through the profile's books link.
Likes live in `rhythmLikes` (one per account/rhythm); comments live in
`rhythmComments`. Public comments require a public profile and are limited to
1,000 characters and ten posts per minute. Comment authors and rhythm owners can
delete comments. All engagement reads check rhythm visibility; deleting a rhythm
also deletes its comments and likes. These ordinary indexes are created on first
API use and need no new MongoDB Search index.

Book QR pages retain selection, playback, and saved practice. Open in score sends
selected exercises to the existing editor for dynamic variations and private
saving or publishing. The book-specific generator has been removed; its legacy
API returns HTTP 410 with guidance to open exercises in Score. Existing QR codes
and account verification continue to work.

Configure `MONGODB_URI`, `MONGODB_DB` (defaults to `drumtoolz`) and `AUTH_SECRET`
in `.env.local` or deployment secrets. Do not commit connection credentials.
Provision the two MongoDB Search indexes in that database:

```sh
npm run search:setup
```

Run it again to check readiness; Search builds indexes asynchronously. To apply
changes to the versioned index definitions, run `npm run search:setup -- --update`.
Definitions are in `src/lib/social/config.js`: explicit mappings exclude account
credentials, emails and private verification data. The application creates the
ordinary unique/lookup indexes on first community API use. The database user
needs collection/index creation privileges and access to MongoDB Search index
management commands. Index provisioning never uses the legacy hardcoded URI.

Nonempty searches use MongoDB Search `$search`, combining autocomplete and text
relevance with visibility/instrument/difficulty filters. Source-document access
checks run after search to account for index update lag. There is no Algolia or
regex fallback. With no query, users can browse recently added public content;
if a search index is still building, search shows an availability message.
See MongoDB's [compound query documentation](https://www.mongodb.com/docs/search/query/operators-collectors/compound/)
and [search index management documentation](https://www.mongodb.com/docs/atlas/atlas-search/manage-indexes/).

Validation:

```sh
npm run test:social
npm run test:book-practice
node node_modules/next/dist/bin/next build
# With a local Next server running (browser API fixtures; no database writes):
node scripts/tests/social.browser.js http://127.0.0.1:3104
node scripts/tests/book-practice.browser.js http://127.0.0.1:3104
```

Browser screenshots are generated under `book-output/community-practice-preview/` and use
explicit test fixtures, not real community members or production seed records.

## Bunny Stream recordings

Rhythms can have one video demonstration and one audio recording. Add or replace
files in the composer's Save dialog or a rhythm's Edit details dialog. New rhythms
with files are first saved as private drafts. Only after successful uploads does
the final save apply the selected visibility. Failed uploads can be retried in
the same dialog without creating another draft or uploading completed files again.

Video cards show Bunny thumbnails with notation directly beneath them in the
community and tempo in the lower right;
levels are hidden from cards, filters, and editing. Opening a card displays its
Bunny recordings and full notation together, with notation below the video and
no content tabs, practice-notes section, or bar-count label. The details layout
reserves space for notation beneath the player; comments scroll separately.
Playback starts
on interaction, not while scrolling the feed. Files encode asynchronously; the
notation remains usable during processing. Existing book-to-Score and save flows
continue to work without media.

### Create and configure a library

1. In your Bunny dashboard, create a **Stream video library** dedicated to
   TrueChops. Both video and supported audio files use this library.
2. From the library's **API** page, copy its library ID and API key. Add them as
   `BUNNY_STREAM_LIBRARY_ID` and `BUNNY_STREAM_API_KEY` in `.env.local` and in your
   deployment's environment settings. Use the library key, not your account key.
3. Copy the library's CDN hostname, such as `vz-example.b-cdn.net`, into
   `BUNNY_STREAM_CDN_HOSTNAME`. Enter only the hostname, without `https://` or a path.
4. On the library's **Security** page, enable **Embed View Token Authentication**
   and **CDN Token Authentication**. Copy the **Token authentication key** into
   `BUNNY_STREAM_TOKEN_KEY`. It is distinct from the library API key. Leave Token
   IP Validation disabled: playback URLs are not bound to an IP address.
5. Set Allowed Domains to your actual application hosts, including
   `truechops.com` and `www.truechops.com`. Add `localhost` / `127.0.0.1` when testing
   locally. Do not include a scheme or path. Keep MP4 fallback and exposed original
   files disabled. These settings and both token-authentication switches protect
   direct access to private recordings, not just their pages in TrueChops.
6. Set `BUNNY_STREAM_WEBHOOK_SECRET` to the library's **Read-Only API key**. Set the
   library's webhook URL to `https://www.truechops.com/api/media/bunny-webhook` (or
   your deployed application's hostname). Bunny must be able to reach this URL.
   The endpoint verifies Bunny's HMAC signature over the raw body, then fetches
   the current recording state to handle duplicate/out-of-order callbacks.
7. Redeploy/restart after setting the environment variables. Upload a small private
   video and MP3, wait for processing, check playback in your own account, and
   check that another account cannot open the rhythm. Publish it and verify the
   video card appears in Discover. Unpublish it and confirm new playback requests
   are denied. Also verify an unsigned Bunny embed/CDN URL cannot play the file.

The blank server settings are also listed in `.env.example`. **Do not prefix any
key with `NEXT_PUBLIC_` or put keys in client code.** Until configured, ordinary
rhythm saving still works; media uploads return a helpful configuration message.

Provider references: [TUS uploads](https://bunny.net/docs/stream/tus-resumable-uploads),
[supported formats](https://bunny.net/docs/stream/video-specification),
[embed signing](https://bunny.net/docs/stream/token-authentication),
[CDN signing](https://bunny.net/docs/cdn/security/token-authentication/advanced),
[security settings](https://bunny.net/docs/stream/security-options), and
[signed webhooks](https://bunny.net/docs/stream/webhooks).

### Uploads, privacy, and maintenance

- MP4/MOV/WebM video: up to 500 MB. MP3/WAV/OGG audio: up to 100 MB. These are
  application admission limits; Bunny validates the contents while encoding.
  Presigned TUS credentials are scoped to an asset, not cryptographically bound
  to the declared file size. Monitor library usage in Bunny for billing limits.
- Signed-in owners alone can start, resume, attach, replace, or remove recordings.
  Clients cannot attach arbitrary Bunny IDs or supply playback URLs. Files travel
  directly to Bunny using `tus-js-client`, bypassing the deployment's request-body
  limit; the API returns an asset-specific signature valid for one hour.
- `rhythmMedia` stores upload ownership and processing state; `rhythmMediaLimits`
  enforces ten new upload attempts per account per hour, even when files are
  removed. Ordinary indexes and an expiry index for the rate-limit buckets are
  created automatically. No additional MongoDB Search index is needed.
- Playback authorization always checks the current rhythm's visibility. Embed
  URLs expire after one hour and thumbnails after ten minutes. Previously issued
  signed URLs remain usable until their expiry, including after unpublishing.
- Removing/replacing media or deleting a rhythm requests deletion from Bunny.
  Failed provider deletions remain queued. Abandoned, unattached uploads older
  than 24 hours can be cleaned up with the maintenance command below. Attached
  recordings and notation are preserved. Configure regular execution in your
  existing operations tooling; this change does not create a scheduled job.

```sh
# Requires explicitly configured MONGODB_URI / MONGODB_DB; defaults to a dry run.
npm run media:cleanup
# Delete abandoned assets and retry queued provider deletions:
npm run media:cleanup -- --apply
# Local protocol/UI check using intercepted Bunny responses (no paid uploads):
node scripts/tests/media.browser.js http://127.0.0.1:3104
```

The browser check exercises the real TUS client against fixtures: file validation,
upload retries, private drafts, publishing, video previews, audio/video players,
notation switching, and removal. A live upload/playback check still requires your
Bunny library and its security/webhook settings.
