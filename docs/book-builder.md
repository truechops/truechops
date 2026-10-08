# Six-book collection

`npm run pdf:book` generates all six volumes from the saved working book in `data/book-builder/snare-drum-book/book.json`, then renders a separate PDF for each in `book-output/`.

| Book | Material |
| --- | --- |
| 1 | Subdivision-only studies from quarters through nontuplets, followed by progressive combinations; no stickings or ornaments |
| 2 | All the other saved tuplet spans and their combinations, with extra rest and density permutations; no ornaments |
| 3 | The complete beginner-to-advanced curriculum, including crazy, off-beat, nested, combination, and final mixed studies; no ornaments |
| 4 | Book 1's scope with the current ornament curriculum |
| 5 | Book 2's expanded scope with the current ornament curriculum |
| 6 | The current working book's complete curriculum, ornament settings, page layouts, and order |

Books 1–3 have **no stickings or ornaments**, including on primary rhythms, secondary rhythms, nested notes, exercise steps, and page tails. Book 6 retains the saved curriculum and order.

The foundations in books 1 and 3 use this inclusion order: **quarter, eighth, sixteenth, triplet, sextuplet, 32nd, quintuplet, septuplet, nontuplet**. The first combination study mixes quarters and eighths. Each subsequent combination study always includes its main subdivision, and draws companion rhythms only from earlier items in that list.

Book 1 starts with **52 pages devoted solely to individual subdivisions**, all before the combinations. Each subdivision starts with dense (65–90% of positions played) practice, then progresses through medium (45–65%), sparse (25–45%), and low (10–25%) density. Quarters use 44 unique two-bar exercises across four pages, covering all 15 non-silent one-bar quarter patterns. Every other subdivision gets 88 exercises across four pages, or eight roomier pages for sextuplets, 32nds, septuplets, and nontuplets. Only the selected subdivision supplies attack positions; the existing notation rules consolidate rests and note values. Two-bar exercises retain both measures in stored scores, uniqueness checks, validation, and PDF layout.

Every main subdivision in the combination studies gets **132 unique exercises**: 44 sparse, 44 medium, and 44 dense. Each density pass starts with 12 exercises that isolate the earlier rhythms one at a time. From sextuplets onward, these introductions use two small groups instead, so later subdivisions have the same exercise budget. Exercise 13 starts a pool of the first two earlier rhythms; every following exercise adds the next rhythm until all preceding rhythms are available. The remaining exercises draw from the complete earlier pool. Each exercise includes the current companion rhythm as well as the main subdivision.

Density stays within a controlled band for each pass (normally 45–60%, 60–75%, and 75–90% of the available note positions). The quarters/eighths introduction is selected systematically from its finite vocabulary, with separate sparse, medium, and dense sets. Most studies occupy six pages; 32nds and nontuplets use twelve roomier pages with the same 132 exercises. Quarter notes remain available as companions throughout this progression. These definitions live in `src/lib/book-rhythm-progression.js`.

A one-beat tuplet with only its opening attack is written as a plain quarter note, with no tuplet bracket. This applies to triplets and the other one-beat tuplet families. The quarter does not count toward the required tuplet type: each measure must still contain a genuine group of that kind. The shared notation rule preserves attack positions and later tuplet indexes; nested groups and ornaments with extra attacks retain their notation.

Advanced rhythm-only pages retain every nested ratio and off-beat start. Nested notes may contain rests. Slow span tuplets can divide a host note into shorter values, down to 32nds, while preserving the tuplet ratio and span; this creates rhythmic differences where the original book used different ornaments or stickings. Books 4–6 retain their ornament curriculum.

Books 2 and 5 exclude the one-quarter-note study group (including its combinations), while retaining quarter-note **tuplets over longer spans**. Every span grouping gains 44 exercises over two additional passes: rest permutations that become sparser, then density and placement permutations that become fuller. Each pass preserves the source's layout, progressive secondary pool, and applicable ornament rules. Exercises are generated uniquely within each book using the existing generator and notation validation.

```sh
npm run pdf:book                          # Generate and render all six
npm run pdf:book -- --volume 2            # Generate and render one volume
npm run pdf:book -- --dry-run             # List each volume's scope/page count
npm run pdf:book -- --render-only         # Render all previously generated volumes
npm run pdf:book:render -- --volume 5     # Render one existing volume
npm run pdf:book:page -- --volume 3 --page 10
npm run pdf:book -- --volume current      # Regenerate the original working book
```

Use `--output-dir <directory>` for the collection, or `--volume <number> --output <file.pdf>` for one book. The book builder's **Six-book collection** selector downloads each generated volume. Existing **Page PDF** and **Book PDF** buttons still export the working book. Generation remains a local command.

Volume definitions live in `src/lib/book-volumes.js`. Generated volumes are stored separately in `data/book-builder/snare-drum-book-<number>-*/book.json`, with inline scores; these reproducible files and the PDFs are ignored by Git. The saved working book is not modified. Each volume has its own QR identity, and the practice endpoints resolve all six volumes as well as the working book. Serving the new QR links requires deploying the updated app **and generated volume data** together.

# Book sections and subsections

The following describes the original working book and its ornament curriculum. The rhythm-only collection applies the progression and exceptions described above.

In `/book-builder`, span groups contain rhythm sections, and each section contains subsections. A subsection is one page by default; set **Pages in this subsection** to spread it over more pages. Each section selects primary rhythms and an optional pool of secondary rhythms. Each subsection has its own title, primary ornaments, played-note limits, sticking rules, and print layout.

The span group sets a count and note value, such as 1 quarter, 2 eighths, or 3 sixteenths. Primary groups retain their note count and stretch/compress across that span, written in standard tuplet notation: four notes over three sixteenths produce a 4:3 group, three notes over two quarters a quarter-note triplet, and nine over two quarters 9:8 sixteenths. A count that matches the span exactly is written as plain notes. Tuplets that span whole beats start on a beat, except in the off-beat section. Secondary rhythms fill the remaining space in the 4/4 exercise. A full/no-rest page needs suitable secondary rhythms if its primary span cannot fill 4/4 evenly. Use **Add group** or **Duplicate group** to organize studies over different spans.

- Every exercise contains each selected primary subdivision and tuplet type, with every selected primary ornament represented on the primary rhythms.
- Secondary rhythms are drawn randomly to fill the remaining space. Their ornaments are optional and apply only to secondary rhythms.
- When a rhythm appears in both pools, the primary settings take precedence. Empty secondary choices use only primary rhythms.
- Changing section rhythms clears generated exercises in all its subsections. Changing a subsection's ornaments or other generation settings clears only that page. Save before regenerating.

Use **Add subsection**, **Move earlier**, **Move later**, and **Delete subsection** to organize topics. Subsections retain stable IDs when reordered, so saved scores stay with their topic. Every page of a subsection shares its title, generation settings, and layout, and each page keeps its own page number and QR code. Lowering the page count removes the subsection's last pages. When a subsection spans several pages, the sticking tail applies only to its last page.

The book opens with **Quarter Notes** (`createQuarterNoteStudy` in `src/lib/book-curriculum.js`), the base of the subdivision pyramid: four short pages of quarter notes and quarter rests with stickings, then accents, then flams, then accents and flams (no diddles or cheese). Outside these pages, plain notes are normally at most a dotted eighth; a beat-long note is written as an eighth and an eighth rest. The exception is a one-beat tuplet with only its opening attack, which simplifies to a quarter note (quarter-note tuplets, such as the quarter-note triplet over two beats, are part of their tuplet and stay). Then come the eighth notes, and the saved book contains sparse and full sections for sixteenths, eighth-note triplets, quintuplets (5:4 sixteenths), sextuplets (6:4 sixteenths), septuplets (7:4 sixteenths), thirty-second notes, and 9:8 thirty-second-note tuplets. Each sparse section has these eight topics:

1. Nothing
2. Accents
3. Accents with stickings
4. Accents with stickings and diddles
5. Accents with stickings and flams
6. Accents with stickings and cheese
7. Accents with stickings, diddles and flams
8. Everything

Full sections use the same order starting with Accents. Full pages with stickings use the regular maximum of two same-hand notes in their earlier rows. Their final five **printed staff rows** allow a maximum of four and require a three- or four-note same-hand run in each exercise. The tail rule follows the page layout (five rows are ten exercises at two measures per row) and can be edited per subsection.

After the one-beat sections come six span groups. Each has a section for every count from 3 to 9 that is a new rhythm over its span; counts whose notes per beat already appear earlier are skipped (5 over five eighths is plain eighths, 8 over three quarters is two 4-over-three-eighths groups, 6 over four quarters is two quarter-note triplets):

| Group | Counts and notation |
| --- | --- |
| Over two quarter notes | 3 (quarter-note triplet), 5:4, 7:4 eighths, 9:8 sixteenths |
| Over three eighth notes | 4:3, 5:3 eighths, 7:6, 8:6 sixteenths |
| Over five eighth notes | 3:5, 4:5, 6:5, 7:5, 8:5, 9:5 eighths |
| Over three quarter notes | 4:3, 5:3 quarters, 7:6 eighths |
| Over seven eighth notes | 3:7, 4:7, 5:7, 6:7, 8:7, 9:7 eighths |
| Over four quarter notes | 3 (half-note triplet), 5:4, 7:4 quarters, 9:8 eighths |
| Over three sixteenth notes | 5:3 sixteenths, 7:6, 8:6, 9:6 thirty-seconds |
| Over five sixteenth notes | 6:5, 7:5, 8:5, 9:5 sixteenths |
| Over seven sixteenth notes | 5:7, 6:7, 8:7, 9:7 sixteenths |
| Over nine sixteenth notes | 4:9, 5:9, 7:9, 8:9 sixteenths |
| Over eleven sixteenth notes | 3:11 through 9:11 sixteenths |
| Over thirteen sixteenth notes | 3:13 through 9:13 sixteenths |
| Over fifteen sixteenth notes | 3:15, 4:15, 7:15, 8:15 sixteenths |

On the sixteenth-note spans, **Primary groups may repeat back to back** is on: each extra group in a row has a 15% chance, so most placements are a single group, and separate placements never run together by accident.

On pages with secondary rhythms, the generator skips any exercise too wide for its share of the printed row (an estimate from its notes, rests, grace notes, dots, and tuplets, with a safety margin). Pages whose rhythm is fixed and too dense for two per row (the 7, 8, and 9 over three sixteenths sections; Septuplets full with flams, cheese, or everything; 32nd notes sparse with flams) print one exercise per row over two pages instead, keeping the same exercise-by-exercise plan. Topic plans, secondary rows, and sticking tails count across both pages of a subsection.

The groups are defined in `SPAN_STUDIES` in `src/lib/book-curriculum.js`. Spans longer than two quarter notes (four eighths), such as five eighths or nine sixteenths, have one **Sparse** page per section, where about half of the primary groups are fully played and the rest include a visible rest (**Fully played primary groups (%)** in the subsection editor; groups alternate through the page so each page stays balanced). Spans of two quarters or less (two quarters; three eighths; three, five, and seven sixteenths) keep two pages: **Every note** (no rests), then **Sparse**. Each page moves through the ornament topics by exercise: Accents with stickings for exercises 1–7, then three exercises each for Accents with stickings and diddles, with flams, with cheese, with diddles and flams, and Everything (22 exercises at two measures per line).

The secondary pool holds every one-beat rhythm (eighths, sixteenths, thirty-seconds, triplets, and 5-, 6-, 7-, and 9-note groups), so the span group can start on any beat. Groups that end mid-beat (over an odd number of eighths or sixteenths) are paired with standalone eighths or sixteenths that complete the beat (thirty-seconds only when nothing longer fits). Over seven eighths that filler is the only room left, and over four quarters the group fills the measure, so those pages have little or no secondary rhythm. Half- and quarter-note tuplets may split a note into shorter values down to tuplet eighths, which can carry diddles and cheese. Every other beat holds one tuplet or a full beat of one regular value. The secondary pool grows down the page: rows 1–2 draw from sixteenths, triplets, and sextuplets; thirty-seconds join at row 3, quintuplets at row 4, septuplets at row 8, and 9s at row 10. Eighths are not used on these pages.

Configure all of this in the subsection editor:

- **Ornaments by rhythm** (in the section's Secondary rhythms box) sets which optional ornaments each secondary rhythm may carry. Triplets, sixteenths, and quintuplets take all of them; sextuplets take flams; the rest take none.
- **Spread ornaments** gives each primary group a few ornaments (an accent and, when it can take one, the exercise's flam, diddle pair, or cheese) and puts each of the exercise's ornaments on the other notes too.
- **Ornament density (% of the book's)** scales the book's ornament density for one subsection (blank is 100).
- **Ornament topics, in order** lists each topic's title, exercise count, and primary ornaments, with a running total against the page's exercise count. **Use one set for the whole page** returns to a single ornament choice.
- **Ornaments, chosen at random for each exercise** (the combination, nested, and final pages) sets the ornaments **On every exercise** (stickings) and the ones **chosen at random**, with how many each exercise adds.
- **Secondary rhythms by row** sets the printed row where each secondary rhythm joins the pool (or Never). A rhythm stays available on every later row.
- **Page plan** summarizes which exercises, rows, ornaments, and secondary rhythms each topic covers.

Notation rules for every page:

- Stickings follow each exercise's topic: when the topic includes stickings, every note has one; otherwise none do. Only the one-beat pages at the start of the book, which give each ornament topic its own page, have topics without stickings (Nothing, Accents). Every exercise after them has stickings.
- Diddles and cheese never go on quarter notes or on regular eighths; eighths inside a tuplet are allowed. On successive notes there is no diddle directly before or after a cheese, and no flam directly after a diddle or cheese.
- Consecutive rests merge into the largest rest, including inside sixteenth-note and faster tuplets. In 32nd-note tuplets, a 32nd note followed by a 32nd rest becomes one sixteenth note (plain 32nds already merge this way within a beat). Two quarter rests on beats one and two, or three and four, become a half rest.
- Eighth-note and shorter notes inside a tuplet share one beam, drawn across rests. Plain notes are beamed by beat, counted from the start of the measure, so the notes before and after a tuplet that starts or ends mid-beat break at the real beats.
- Tuplet brackets show only the count (3, 5, 6, 7, 9) for standard groups and a ratio (4:3, 5:3, 7:6, 8:6) otherwise.

The original eighth-note and mixed-tuplet studies remain alongside this curriculum. Secondary pools start empty. Printed contents list span groups, rhythm sections, and subsections across as many contents pages as necessary.

## Tuplets off the beat

After the span sections and before the combinations, each one-beat tuplet (triplets, quintuplets, sextuplets, septuplets, nontuplets) gets two pages where it starts off the beat (`createOffbeatStudies` in `src/lib/book-curriculum.js`): on the "e" for exercises 1–15, the "+" for 16–30, and the "a" for 31–44 (**Off-beat starts, in order** in the subsection editor). The group still lasts one quarter note, so it ends at the same point of the next beat. Sparse sixteenths (55–80% of the notes) lead into it, complete its beats, and fill the rest of the measure, so the placement reads against the sixteenth-note grid and the rests (merged into eighths and dotted values) make syncopations; the group can fall in beats 1–2, 2–3, or 3–4. Two in three groups are played in full; the rest keep a rest inside (in 9:8 groups a note and the rest after it read as one sixteenth).

Each start goes through the ornament steps (`OFFBEAT_STEPS`), about three exercises each, with stickings on every note throughout:

1. Accents.
2. Accents and diddles.
3. Accents and flams.
4. Accents and cheese.
5. Everything (accents, flams, diddles, and cheese).

Every exercise shows each of its step's ornaments and no others. The ornaments are spread out (**Spread ornaments** in the subsection editor): the moving tuplet carries a few ornaments, not one on every note. When the step has flams, diddles, or cheese the tuplet can take, it carries one of them: diddles usually as a pair in a row (sticked hand to hand, RRLL), flams one or two, cheese one. An accent leads, often on the tuplet's first note (shared with the rudiment in triplets); larger tuplets now and then get a second accent. Each of the step's ornaments also appears on the sixteenths, and the diddles, flams, and cheese steps feature their ornament: 3–4 of it in each exercise (diddles in pairs where they fit), with at most four accents, so each step of the progression reads clearly. Septuplets and nontuplets still take only accents, and sextuplets only accents and flams. Ornaments are busier than in the rest of the book (**Ornament density (% of the book's)** is 130 on these pages). Every tuplet takes accents here, so each step accents the group itself, even 7s and 9s; septuplets and nontuplets still take no flams, diddles, or cheese, and sextuplets only flams, so those land on the sixteenths.

**Mixing off-beat tuplets** (two more pages) puts two different tuplets in each exercise, each starting on a random "e", "+", or "a" with sparse sixteenths before and after it, going through every pair in turn from the slowest to the fastest: 3 and 5, 3 and 6, 5 and 6, 3 and 7, 5 and 7, 6 and 7, 3 and 9, 5 and 9, 6 and 9, 7 and 9 (**Two off-beat tuplets per exercise** in the subsection editor). The same ornament steps run once across the two pages, about nine exercises each.

## Tuplet combinations

After the single-tuplet sections, each tuplet in the book gets two pages of combinations (`createTupletCombinationStudies` in `src/lib/book-curriculum.js`): first the seven one-beat subdivisions (triplets, sixteenths, sextuplets, 32nds, quintuplets, septuplets, nontuplets), then every grouping of each span group, in book order. Every exercise contains the section's tuplet. The rest of the measure draws from basic one-beat subdivisions in a pool that grows down the two pages (**Secondary rhythms by row**): for triplets, sixteenths, then sextuplets, 32nds, quintuplets, septuplets, and nontuplets; for longer groupings, triplets first and the rest in the same order. Groupings that end mid-beat also get sixteenths from the start, to complete the beat. Each exercise includes the most recently added subdivision at least once (**Each exercise includes the newest secondary rhythm**), unless the section's grouping leaves no room for it (four quarters, seven eighths, thirteen and fifteen sixteenths). Each exercise has stickings plus 1–3 other ornaments chosen at random, and secondary notes use only that exercise's set. Groups of 7–9 notes in a quarter note or less still take only stickings and sextuplets only flams; on those sections the exercise's other ornaments land on the secondary notes.

## Nested tuplets

Before the final section, each tuplet over one, two, three, and four quarter notes gets its own nested-tuplet subsection (`createNestedStudies` in `src/lib/book-curriculum.js`): triplets, quintuplets, sextuplets, septuplets, and nontuplets over a quarter note, then every grouping of the two-, three-, and four-quarter span groups (16 subsections). Every exercise nests one smaller tuplet inside one of its primary groups, replacing a run of the group's notes:

- 3, 5, 7, 9, and 11 in the time of two host notes;
- then, for each longer run of k host notes (short of the whole group), k − 1 and k + 1 notes: 2 and 4 over three, 3 and 5 over four, and so on;
- 11 over eight in nine-note groups.

Ratios that are just shorter regular notes (4 over two, 2 over four) are skipped, as are variants that would need notes shorter than 32nds (so 9 and 11 over two sextuplet sixteenths do not appear). The nested bracket uses the host's note value, or the next shorter value when the nested group has at least twice as many notes: 5 over two triplet eighths is written 5:4 sixteenths.

The variants run in order (**Nested tuplets, in order** in the subsection editor), and each variant's exercises step through four stages (**Steps for each nested tuplet**; the off-beat section uses the same steps for each start):

1. Every note, stickings only.
2. Every note, stickings and accents.
3. Sparse, stickings and accents: 50–75% of the notes, with a rest in every primary group (the nested notes are always played).
4. Every note, stickings plus 2–4 other ornaments chosen at random. Diddles and cheese are left out of the draw when nothing can carry them: a host that fills the measure with quarter or half notes, whose nested group is no faster than quarters.

A variant's exercises split evenly over the steps, and any extra exercises go to the later steps. Each host gets three pages (four for 9 over four quarters, whose 18 variants need 72 exercises), 49 pages in all. The steps set the ornaments on secondary notes too. The rest of the measure uses the easy pool (triplets, sixteenths, sextuplets). Fast hosts keep their limits: 7–9 notes in a quarter note take only stickings, and sextuplets only flams. On those pages, a step's accents and other ornaments are placed on secondary notes, so every step shows its ornaments.

The renderer draws the nested bracket inside the host's bracket (the stave has extra room above row one for the outer bracket), and playback multiplies the ratio of every tuplet that contains a note.

- **Book builder:** **Nested tuplets** in the subsection editor turns nesting on for any page whose primary rhythm is a tuplet. Choose each variant and its exercise count, reorder them, or use **Spread all evenly**. Below the variants, edit each step's title, density (every note; all or two in three primary groups in full with sparse notes around them; sparse; or 50–75% of notes with a rest in every primary group), and ornaments (a fixed set, or random with ornaments on every exercise). **Use the page's ornaments and density** removes the steps.
- **Exercise generator:** **Nested tuplets** offers None, each variant in turn, or one specific variant, and **Start the tuplet** offers the beat, the "e", "+", or "a", or each in turn (one or the other, not both). **Steps** gives each nested tuplet four measures (every note to sparse) or each off-beat start five (the ornament steps), one per step, in place of the configuration's density and ornaments; a nested or off-beat book page's own configuration has it on. Off-beat groups get sixteenths around them when the configuration has no plain secondary subdivision. In the composer, each **Add measure** continues to the next step, nested tuplet, or start.
- **Composer:** with a tuplet selected, clicking a note inside an existing tuplet nests the new tuplet there (one level deep).

## Random subdivisions and ornaments

The book ends with one three-page section per span category (`createFinalStudies` in `src/lib/book-curriculum.js`), in this order: one quarter note, two quarters, three eighths, three quarters, five eighths, four quarters, seven eighths, then three through fifteen sixteenths. Every exercise includes at least one grouping from the section's category (**Primary rhythms in each exercise: At least one**), sometimes more, in random places. The rest of the measure is filled from basic one-beat notes and the other categories' groupings. The basic notes get harder by page (`secondaryRhythmPhases`): easy (triplets, sixteenths, sextuplets), medium (sextuplets, 32nds, quintuplets), then hard (sextuplets, nontuplets). Sixteenths can still complete a beat after a grouping that ends mid-beat (`fillerSubdivisions`), but never fill a beat on their own on the medium and hard pages. The other categories join the pool one at a time in the order above, spread evenly across all three pages by exercise, so a category can arrive mid-row (`secondaryRhythmExercises`). Each exercise has stickings plus 1–3 other ornaments chosen at random; fast groups (7–9 notes, or 6, in a quarter note or less) keep their stickings-only and flams-only limits.

## Exercise generator on the website

The same generator makes new exercises on the website from an **exercise configuration**: subdivision, the span it is spread over, secondary rhythms, density (every note or sparse, with an optional share of fully played groups), ornaments, and tempo (`src/lib/exercise-config.js`).

- **Composer:** the **Generate** tab picks a configuration (edit it with **Edit settings**) and **Add measure** appends one generated measure to the score.
- **Book QR pages:** besides **Choose rhythms**, the **Generate exercises** tab lists the page's own configuration and your saved ones. Edit one, save it, and build a score of 1–16 measures.
- Saved configurations belong to the signed-in user (`exerciseConfigs` in MongoDB, `/api/exercise-configs`); signed-out visitors keep them in the browser. `/api/exercise-generator` returns the measures.

Regenerate the working book's exercises with `npm run book:generate:ai -- --no-local-ai`. To regenerate its exercises and export its PDF, use `npm run pdf:book -- --volume current`. To export its existing exercises without regeneration, use `npm run pdf:book:render`. Use `npm run pdf:book` for the six-volume collection described above.

Run the migration, generation, and API regression checks with `npm run test:book`.
