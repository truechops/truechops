# Book sections and subsections

In `/book-builder`, span groups contain rhythm sections, and each section contains subsections. A subsection is one page by default; set **Pages in this subsection** to spread it over more pages. Each section selects primary rhythms and an optional pool of secondary rhythms. Each subsection has its own title, primary ornaments, played-note limits, sticking rules, and print layout.

The span group sets a count and note value, such as 1 quarter, 2 eighths, or 3 sixteenths. Primary groups retain their note count and stretch/compress across that span, written in standard tuplet notation: four notes over three sixteenths produce a 4:3 group, three notes over two quarters a quarter-note triplet, and nine over two quarters 9:8 sixteenths. A count that matches the span exactly is written as plain notes. Tuplets that span whole beats always start on a beat. Secondary rhythms fill the remaining space in the 4/4 exercise. A full/no-rest page needs suitable secondary rhythms if its primary span cannot fill 4/4 evenly. Use **Add group** or **Duplicate group** to organize studies over different spans.

- Every exercise contains each selected primary subdivision and tuplet type, with every selected primary ornament represented on the primary rhythms.
- Secondary rhythms are drawn randomly to fill the remaining space. Their ornaments are optional and apply only to secondary rhythms.
- When a rhythm appears in both pools, the primary settings take precedence. Empty secondary choices use only primary rhythms.
- Changing section rhythms clears generated exercises in all its subsections. Changing a subsection's ornaments or other generation settings clears only that page. Save before regenerating.

Use **Add subsection**, **Move earlier**, **Move later**, and **Delete subsection** to organize topics. Subsections retain stable IDs when reordered, so saved scores stay with their topic. Every page of a subsection shares its title, generation settings, and layout, and each page keeps its own page number and QR code. Lowering the page count removes the subsection's last pages. When a subsection spans several pages, the sticking tail applies only to its last page.

The saved book contains sparse and full sections for sixteenths, eighth-note triplets, quintuplets (5:4 sixteenths), sextuplets (6:4 sixteenths), septuplets (7:4 sixteenths), thirty-second notes, and 9:8 thirty-second-note tuplets. Each sparse section has these eight topics:

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

The groups are defined in `SPAN_STUDIES` in `src/lib/book-curriculum.js`. Spans longer than two quarter notes (four eighths), such as five eighths or nine sixteenths, have one **Sparse** page per section, where about half of the primary groups are fully played and the rest include a visible rest (**Fully played primary groups (%)** in the subsection editor; groups alternate through the page so each page stays balanced). Spans of two quarters or less (two quarters; three eighths; three, five, and seven sixteenths) keep two pages: **Every note** (no rests), then **Sparse**. Each page moves through the ornament topics by exercise: Accents for exercises 1–4, then three exercises each for Accents with stickings, with diddles, with flams, with cheese, with diddles and flams, and Everything (22 exercises at two measures per line).

The secondary pool holds every one-beat rhythm (eighths, sixteenths, thirty-seconds, triplets, and 5-, 6-, 7-, and 9-note groups), so the span group can start on any beat. Groups that end mid-beat (over an odd number of eighths or sixteenths) are paired with standalone eighths or sixteenths that complete the beat (thirty-seconds only when nothing longer fits). Over seven eighths that filler is the only room left, and over four quarters the group fills the measure, so those pages have little or no secondary rhythm. Half- and quarter-note tuplets may split a note into shorter values down to tuplet eighths, which can carry diddles and cheese. Every other beat holds one tuplet or a full beat of one regular value. The secondary pool grows down the page: rows 1–2 draw from sixteenths, triplets, and sextuplets; thirty-seconds join at row 3, quintuplets at row 4, septuplets at row 8, and 9s at row 10. Eighths are not used on these pages.

Configure all of this in the subsection editor:

- **Ornaments by rhythm** (in the section's Secondary rhythms box) sets which optional ornaments each secondary rhythm may carry. Triplets, sixteenths, and quintuplets take all of them; sextuplets take flams; the rest take none.
- **Ornament topics, in order** lists each topic's title, exercise count, and primary ornaments, with a running total against the page's exercise count. **Use one set for the whole page** returns to a single ornament choice.
- **Secondary rhythms by row** sets the printed row where each secondary rhythm joins the pool (or Never). A rhythm stays available on every later row.
- **Page plan** summarizes which exercises, rows, ornaments, and secondary rhythms each topic covers.

Notation rules for every page:

- Stickings follow each exercise's topic: when the topic includes stickings, every note has one; otherwise none do.
- Diddles and cheese never go on quarter notes or on regular eighths; eighths inside a tuplet are allowed. On successive notes there is no diddle directly before or after a cheese, and no flam directly after a diddle or cheese.
- Consecutive rests merge into the largest rest, including inside sixteenth-note and faster tuplets. In 32nd-note tuplets, a 32nd note followed by a 32nd rest becomes one sixteenth note (plain 32nds already merge this way within a beat). Two quarter rests on beats one and two, or three and four, become a half rest.
- Eighth-note and shorter notes inside a tuplet share one beam, drawn across rests.
- Tuplet brackets show only the count (3, 5, 6, 7, 9) for standard groups and a ratio (4:3, 5:3, 7:6, 8:6) otherwise.

The original eighth-note and mixed-tuplet studies remain alongside this curriculum. Secondary pools start empty. Printed contents list span groups, rhythm sections, and subsections across as many contents pages as necessary.

## Tuplet combinations

After the single-tuplet sections, each tuplet in the book gets two pages of combinations (`createTupletCombinationStudies` in `src/lib/book-curriculum.js`): first the seven one-beat subdivisions (triplets, sixteenths, sextuplets, 32nds, quintuplets, septuplets, nontuplets), then every grouping of each span group, in book order. Every exercise contains the section's tuplet. The rest of the measure draws from basic one-beat subdivisions in a pool that grows down the two pages (**Secondary rhythms by row**): for triplets, sixteenths, then sextuplets, 32nds, quintuplets, septuplets, and nontuplets; for longer groupings, triplets first and the rest in the same order. Groupings that end mid-beat also get sixteenths from the start, to complete the beat. Each exercise includes the most recently added subdivision at least once (**Each exercise includes the newest secondary rhythm**), unless the section's grouping leaves no room for it (four quarters, seven eighths, thirteen and fifteen sixteenths). Each exercise picks 2–4 ornaments at random, and secondary notes use only that exercise's set. Groups of 7–9 notes in a quarter note or less still take only stickings and sextuplets only flams; on those sections the exercise's other ornaments land on the secondary notes.

## Random subdivisions and ornaments

The book ends with one three-page section per span category (`createFinalStudies` in `src/lib/book-curriculum.js`), in this order: one quarter note, two quarters, three eighths, three quarters, five eighths, four quarters, seven eighths, then three through fifteen sixteenths. Every exercise includes at least one grouping from the section's category (**Primary rhythms in each exercise: At least one**), sometimes more, in random places. The rest of the measure is filled from basic one-beat notes and the other categories' groupings. The basic notes get harder by page (`secondaryRhythmPhases`): easy (triplets, sixteenths, sextuplets), medium (sextuplets, 32nds, quintuplets), then hard (sextuplets, nontuplets). Sixteenths can still complete a beat after a grouping that ends mid-beat (`fillerSubdivisions`), but never fill a beat on their own on the medium and hard pages. The other categories join the pool one at a time in the order above, spread evenly across all three pages by exercise, so a category can arrive mid-row (`secondaryRhythmExercises`). Each exercise picks 2–4 ornaments at random; fast groups (7–9 notes, or 6, in a quarter note or less) keep their stickings-only and flams-only limits.

## Exercise generator on the website

The same generator makes new exercises on the website from an **exercise configuration**: subdivision, the span it is spread over, secondary rhythms, density (every note or sparse, with an optional share of fully played groups), ornaments, and tempo (`src/lib/exercise-config.js`).

- **Composer:** the **Generate** tab picks a configuration (edit it with **Edit settings**) and **Add measure** appends one generated measure to the score.
- **Book QR pages:** besides **Choose rhythms**, the **Generate exercises** tab lists the page's own configuration and your saved ones. Edit one, save it, and build a score of 1–16 measures.
- Saved configurations belong to the signed-in user (`exerciseConfigs` in MongoDB, `/api/exercise-configs`); signed-out visitors keep them in the browser. `/api/exercise-generator` returns the measures.

Regenerate exercises with `npm run book:generate:ai -- --no-local-ai`. To regenerate exercises and export the PDF, use `npm run pdf:book`. To export existing exercises without regeneration, use `npm run pdf:book:render`.

Run the migration, generation, and API regression checks with `npm run test:book`.
