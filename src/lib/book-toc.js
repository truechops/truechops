const { createStructureTableOfContents } = require("./book-structure");

// Both PDF entry points share pagination, so large curricula keep readable contents.
function drawBookTableOfContents(doc, book) {
  const entries = createStructureTableOfContents(book.sections, book.groups);
  const margin = 48;
  const width = 612 - margin * 2;
  const pageNumberWidth = 46;
  const rowHeight = 17;
  let y;
  let contentsPage = 0;
  const addPage = () => {
    contentsPage += 1;
    doc.addPage();
    doc.font("Times-Roman").fillColor("#111111").fontSize(24)
      .text(book.title || "Snare Drum Book", margin, 48, { width, align: "center", lineBreak: false });
    doc.font("Times-Bold").fontSize(18)
      .text(contentsPage === 1 ? "Table of Contents" : "Table of Contents (continued)", margin, 91,
        { width, align: "center", lineBreak: false });
    y = 134;
  };
  addPage();
  entries.forEach((entry) => {
    const heading = !entry.subsectionId;
    if (y + rowHeight * (heading ? 2 : 1) > 746) addPage();
    const indent = entry.groupId ? 0 : entry.subsectionId ? 26 : 12;
    const label = entry.sectionNumber ? `${entry.sectionNumber}. ${entry.title}` : entry.title;
    const pageLabel = entry.pageStart == null ? "" : entry.pageEnd !== entry.pageStart
      ? `${entry.pageStart}\u2013${entry.pageEnd}` : String(entry.pageStart);
    const titleWidth = width - pageNumberWidth - indent - 12;
    doc.font(heading ? "Times-Bold" : "Times-Roman").fontSize(10).fillColor("#111111");
    doc.text(label, margin + indent, y, { width: titleWidth, lineBreak: false, ellipsis: true });
    doc.text(pageLabel, margin + width - pageNumberWidth, y,
      { width: pageNumberWidth, align: "right", lineBreak: false });
    const start = margin + indent + Math.min(doc.widthOfString(label), titleWidth - 8) + 7;
    const end = margin + width - pageNumberWidth - 7;
    if (end > start) doc.save().strokeColor("#777777").lineWidth(0.5).dash(1, { space: 2 })
      .moveTo(start, y + 8).lineTo(end, y + 8).stroke().restore();
    y += rowHeight;
  });
}

module.exports = { drawBookTableOfContents };
