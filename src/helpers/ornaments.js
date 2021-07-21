export function toggleOrnament(note, ornament) {
  if (note.ornaments) {
    if (ornament)
      if (note.ornaments.includes(ornament)) {
        note.ornaments = note.ornaments.replace(ornament, "");
      } else {
        note.ornaments = note.ornaments.concat(ornament);
      }
  } else {
    note.ornaments = ornament;
  }
}

function toggleSimple(ornaments, ornament) {
    if (ornaments.includes(ornament)) {
      ornaments = ornaments.replace(ornament, "");
    } else {
      ornaments = ornaments.concat(ornament);
    }
  }

export function toggleAccent(ornaments, a) {
  toggleSimple(ornaments, a);
}



function toggleSticking(ornaments, ornament, clear) {
  ornaments.replace(`/[${clear}]/`, ornaments.includes(ornament) ? '' : ornament);
}