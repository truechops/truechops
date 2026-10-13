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

The community feed starts at `/discover`. Its search bar opens `/search`, with
live MongoDB Search results in All, Rhythms and People tabs. Search text, filters
and category are reflected in the URL; changing categories preserves the query.
All shows both result types, with independent loading and retry states.
`/profile` and `/library`
show the signed-in account's creations and privately saved community rhythms.
Public profiles use `/u/:handle`; individual rhythms use `/rhythms/:id`.
Feed cards show only exercise content. Opening a card uses a shareable `?rhythm=`
modal over the feed; Escape/Back restores the feed and keyboard focus. The modal
contains the full notation, creator, practice notes, comments, likes, and library
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
