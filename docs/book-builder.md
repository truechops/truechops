# Book sections and subsections

In `/book-builder`, each section selects primary rhythms and an optional pool of secondary rhythms. Each subsection is one page with its own title, primary ornaments, played-note limits, sticking rules, and print layout.

- Every exercise contains each selected primary subdivision and tuplet type, with every selected primary ornament represented on the primary rhythms.
- Secondary rhythms are drawn randomly to fill the remaining space. Their ornaments are optional and apply only to secondary rhythms.
- When a rhythm appears in both pools, the primary settings take precedence. Empty secondary choices use only primary rhythms.
- Changing section rhythms clears generated exercises in all its subsections. Changing a subsection's ornaments or other generation settings clears only that page. Save before regenerating.

Use **Add subsection**, **Move earlier**, **Move later**, and **Delete subsection** to organize topics. Subsections retain stable IDs when reordered, so saved scores stay with their topic.

Legacy sections are consolidated by adjacent rhythm family when loaded. The saved snare book now contains five sections and 27 subsections, preserving all 594 existing exercises, their page order, and their individual settings. Secondary pools start empty to preserve the original rhythm choices.

Regenerate exercises with `npm run book:generate:ai -- --no-local-ai`. To regenerate exercises and export the PDF, use `npm run pdf:book`. To export existing exercises without regeneration, use `npm run pdf:book:render`.

Run the migration, generation, and API regression checks with `npm run test:book`.
