truechops.com

'main' branch is set up to automatically deploy to production.

To contribute, branch off of main, and then submit a PR.

Direct commits against 'main' are rejected.

Current desired changes:

1. Playback position tracker.
2. Multiple time signatures.
3. Measure copy/paste (implemented in the floating measure toolbar)
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
The profile has Rhythms and Saved tabs. Navigation
lives in the left sidebar; smaller screens open it with the menu button.
Public profiles use `/u/:handle`; individual rhythms use `/rhythms/:id`.
Feed cards show only exercise content. Opening a card uses a shareable `?rhythm=`
immersive viewer over the feed; Escape/Back restores the feed and keyboard focus.
The viewer places creator and rhythm metadata at the top left, video and notation
in the center, and comments, variations, and save controls on the right. Comments
and variations open an independently scrolling side panel. Select one or two
of stickings, accents, diddles, cheese, and flams to generate variations continuously
as you scroll. Missing ornaments are introduced; incompatible ornaments occupy
separate notes. Timing and rests stay unchanged. Preview or play a variation,
save it privately to your profile, or open it in Score. Maximize fills the screen
with a responsive grid of up to three variations per row. Escape restores the
panel before closing it. Only visible rows are rendered and generation pages are
cached in bounded memory; small patterns may recur because their possibilities
are finite.
For drum-set rhythms, the choices are Kick, Snare, Hi-hat, Ride, Hi-hat Foot,
and Toms 1–4, with the same two-selection limit. These variations move the selected
voices' hits between existing rhythmic positions, introduce missing voices, or
thin a continuous pattern. Other voices, note durations, and tuplets stay intact.
Scores with multiple enabled instruments offer an instrument selector; only that
part is adjusted. Changing instruments clears the previous variation selection.
Scroll the viewer vertically for similar public rhythms, matched by instrument
and ranked by tags, meter, and tempo among the latest 200 candidates. Offscreen
players are removed to stop playback. Its Open in score action copies the current
notation and tempo into the editor. Direct `/rhythms/:id` links use the same viewer.
Use the composer's Save button to save privately or publish. Publishing requires
an explicitly created public profile. Existing saved scores remain private.

The APIs reuse the Google session cookie and account ID. Public profiles live in
`profiles`, scores remain in `rhythms`, and account-scoped bookmarks live in
`rhythmSaves`. Saved rhythms reference their original: unpublishing or deleting
a rhythm also removes it from other users' visible collections. Books and saved
book practice are no longer linked from Profile or the sidebar.
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
continue to work. Book verification has been removed; its legacy API also returns
HTTP 410. No ownership check is required to practice or save book rhythms.

Hover over a measure in Score and click its small adjustment icon to open the
floating toolbar. The icon is also available by keyboard and stays visible on
touchscreens. Copy captures the full
measure; Paste inserts it to the left or right of the selected measure. Duplicate
inserts a copy to the right. Adjust offers Shuffle for stickings, accents, diddles,
cheese, and flams, or individual kit voices for drum-set parts. Missing diddles,
cheese, and flams are introduced. Existing
markings are shuffled while preserving timing and rests. Adjust also offers
Browse variations: preview, play, combine categories, or maximize to a full-screen
grid, then choose Use variation to apply to that measure. All edits support Undo/Redo.
The Score tabs are Measure, Notes, Ornaments, and Mutate; Generate has been removed.

Find matching rhythms in the measure's Adjust menu searches public rhythms by
that measure's actual notation. The search icon in Score's toolbar uses the whole
score; Search by notation on the community page opens the same flow. The query
matches note lengths, dots, rests, meter, and tuplets, including contiguous passages
inside longer rhythms. Optionally require matching stickings and ornaments.
Tempo, pitch, title, and creator do not affect a match. Multiple parts and voices
retain their written order. Result cards preview the matching passage; opening
one shows the complete rhythm. The notation snapshot stays in tab storage, with
Use current score available to refresh it. This read-only search uses the existing
scores directly and requires no new search index or data migration.

Configure `MONGODB_URI`, `MONGODB_DB` (defaults to `drumtoolz`) and `AUTH_SECRET`
in `.env.local` or deployment secrets. Do not commit connection credentials.
Provision the two MongoDB Search indexes in that database:

```sh
npm run search:setup
```

Run it again to check readiness; Search builds indexes asynchronously. To apply
changes to the versioned index definitions, run `npm run search:setup -- --update`.
Definitions are in `src/lib/social/config.js`: explicit mappings exclude account
credentials and private account data. The application creates the
ordinary unique/lookup indexes on first community API use. The database user
needs collection/index creation privileges and access to MongoDB Search index
management commands. Index provisioning never uses the legacy hardcoded URI.

Nonempty text searches use MongoDB Search `$search`, combining autocomplete and text
relevance with visibility/instrument/difficulty filters. Source-document access
checks run after search to account for index update lag. There is no Algolia or
regex fallback. With no query, users can browse recently added public content;
if a search index is still building, search shows an availability message.
See MongoDB's [compound query documentation](https://www.mongodb.com/docs/search/query/operators-collectors/compound/)
and [search index management documentation](https://www.mongodb.com/docs/atlas/atlas-search/manage-indexes/).

Validation:

```sh
npm run test:social
npm run test:measures
npm run test:book-practice
node node_modules/next/dist/bin/next build
# With a local Next server running (browser API fixtures; no database writes):
node scripts/tests/social.browser.js http://127.0.0.1:3104
node scripts/tests/immersive.browser.js http://127.0.0.1:3104
node scripts/tests/measure-editing.browser.js http://127.0.0.1:3104
node scripts/tests/instrument-variations.browser.js http://127.0.0.1:3104
node scripts/tests/notation-search.browser.js http://127.0.0.1:3104
node scripts/tests/book-practice.browser.js http://127.0.0.1:3104
node scripts/tests/practice-catalog.browser.js http://127.0.0.1:3104
node scripts/tests/byos.browser.js http://127.0.0.1:3104
```

Browser screenshots are generated under `book-output/community-practice-preview/` and use
explicit test fixtures, not real community members or production seed records.

## Practice library

Rudiments and Drills share a responsive card layout with category controls and
name search at the top. Notation fits inside each card and is drawn as cards
approach the viewport. Open in score preserves the rhythm, tempo and dynamic
settings. Drills also retain their shuffle action; shuffling a preview never
changes the bundled source rhythm.

BYOS uses the same practice-library styling. Type a phrase or add letters from
the alphabet to build a live notation preview, then open it in Score at 120 BPM.
Both letter cases work; spaces, numbers and punctuation are skipped, including
at the beginning of a phrase. Phrases allow up to 64 characters. Each occurrence
of a letter becomes an independent measure, so editing one never changes another
or the alphabet. A compact phrase bar keeps Score and the current phrase within
reach while browsing the alphabet. The notation guide works on mobile and can
be closed with Escape. Run the phrase-building checks with
`node --test scripts/tests/byos.test.js`.

## YouTube demonstrations

Paste a YouTube link in the composer's Save dialog or a rhythm's Edit details.
Watch, share (`youtu.be`), Shorts, live and embed links are supported, including
start times. Links are validated on both client and server and stored as a
canonical `youtubeUrl` with the rhythm. No API key or YouTube metadata request
is needed. Clear the field or choose Remove YouTube link to detach the video.

Search/profile cards use lazy thumbnail images with notation underneath.
The immersive viewer uses a thumbnail until Play is clicked, then mounts a
privacy-enhanced YouTube iframe. Leaving that rhythm unmounts the player.
Notation remains beneath the video; Watch on YouTube opens the original video
if the creator has disabled embedding. A YouTube link takes precedence over an
older uploaded video. YouTube availability and embedding permissions remain
controlled by the video owner.

The video upload UI is commented out in `RhythmDialog.js` for later restoration.
Its upload code, API routes and existing Bunny video playback are retained.
Audio uploads remain available.

## Bunny Stream recordings (audio and existing video)

Rhythms can retain one uploaded video and one audio recording. Add or replace
audio in the composer's Save dialog or a rhythm's Edit details dialog. New rhythms
with files are first saved as private drafts. Only after successful uploads does
the final save apply the selected visibility. Failed uploads can be retried in
the same dialog without creating another draft or uploading completed files again.

Existing uploaded video cards show Bunny thumbnails with notation directly beneath them in the
community and tempo in the lower right;
levels are hidden from cards, filters, and editing. Opening a card displays its
Bunny recordings and full notation together, with notation below the video and
no content tabs, practice-notes section, or bar-count label. The details layout
reserves space for notation beneath the player; comments and variations scroll separately.
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
node scripts/tests/immersive.browser.js http://127.0.0.1:3104
```

The browser check exercises the real TUS client against fixtures: file validation,
upload retries, private drafts, publishing, video previews, audio/video players,
notation, immersive panels, similar rhythms, and removal. A live upload/playback check still requires your
Bunny library and its security/webhook settings.
