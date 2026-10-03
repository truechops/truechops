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

The **Over three eighth notes** group follows the same layout with 4:3 and 5:3 eighths and 7:6 and 8:6 sixteenths. These groups end mid-beat, so each is paired with one eighth or two sixteenths to complete its beat. Ratios are printed whenever the plain number would be ambiguous.

The **Over two quarter notes** group has one page each for 3, 5, 7, and 9 notes over two beats. Each page cycles through the ornament topics by exercise: exercises 1–4 are Accents, then three exercises each for the six topics from Accents with stickings to Everything (22 exercises at two measures per line). The secondary pool holds every one-beat rhythm (eighths, sixteenths, thirty-seconds, triplets, and 5-, 6-, 7-, and 9-note groups), so the two-beat group can start on any beat. In the first five printed rows (exercises 1–10), secondary rhythms are limited to triplets and sixteenths; quintuplets through nine-note groups, eighths, and thirty-seconds join from row six. Secondary ornaments apply only to triplets, sixteenths, and quintuplets. On these pages every beat holds one tuplet or a full beat of one regular value. Quarter-note triplets may split a quarter into two eighths, which can carry diddles and cheese.

Notation rules for every page:

- Diddles and cheese never go on quarter notes or on regular eighths; eighths inside a tuplet are allowed. Thirty-seconds follow the sixteenth-note sequencing rules, so no cheese directly after a diddle.
- Consecutive rests merge into the largest rest, including inside sixteenth-note and faster tuplets. Two quarter rests on beats one and two, or three and four, become a half rest.
- Eighth-note and shorter notes inside a tuplet share one beam across rests.

The original eighth-note and mixed-tuplet studies remain alongside this curriculum. Secondary pools start empty. Printed contents list span groups, rhythm sections, and subsections across as many contents pages as necessary.

Regenerate exercises with `npm run book:generate:ai -- --no-local-ai`. To regenerate exercises and export the PDF, use `npm run pdf:book`. To export existing exercises without regeneration, use `npm run pdf:book:render`.

Run the migration, generation, and API regression checks with `npm run test:book`.
