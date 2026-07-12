import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  FaArrowDown,
  FaArrowUp,
  FaBook,
  FaEraser,
  FaEye,
  FaFolderOpen,
  FaFilePdf,
  FaMagic,
  FaPlus,
  FaSave,
  FaTrash,
  FaUpload,
} from "react-icons/fa";

import { Dialog as MuiDialog } from "@mui/material";
import Dialog from "../ui/Dialog";
import { scoreActions } from "../../store/score";
import { drawScore, initialize } from "../../lib/vexflow";
import {
  PDF_COLUMN_OPTIONS,
  getLinesPerPage,
  getPagePdfSettings,
  createBlankLine,
  createBlankLineScore,
  createBlankPage,
  createBookSection,
  createDefaultBook,
  normalizePdfSettings,
  normalizeBook,
  renumberPages,
  scoreToBookLine,
} from "./book-data";
import styles from "./BookBuilder.module.css";

function IconButton({ children, disabled, icon, onClick, title, variant = "default" }) {
  return (
    <button
      className={`${styles.button} ${styles[variant] || ""}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function Field({ children, label }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSectionId(title, existingSections = []) {
  const base = String(title || "section")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const existingIds = new Set(existingSections.map((section) => section.id));
  let id = base;
  let suffix = 2;

  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  return id;
}

function LinePreview({ line }) {
  const reactId = useId();
  const previewId = `book-line-preview-${reactId.replace(/:/g, "")}-${line.pageNumber}-${line.lineNumber}`;

  useEffect(() => {
    if (!line.score) {
      return;
    }

    const container = document.getElementById(previewId);
    if (!container) {
      return;
    }

    container.innerHTML = "";
    const { renderer, context } = initialize(previewId);
    drawScore(
      renderer,
      context,
      line.score,
      null,
      () => {},
      {
        width: 340,
        scale: 0.42,
        hResize: 0.42,
        vResize: 0.42,
        justifyLastRow: true,
      },
      {}
    );
  }, [line.score, previewId]);

  if (!line.score) {
    return (
      <div className={styles.blankPreview}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }

  return <div className={styles.preview} id={previewId} />;
}

function mapBookPages(book, mapper) {
  let pageIndex = 0;
  const sections = book.sections.map((section, sectionIndex) => ({
    ...section,
    pages: section.pages.map((page, sectionPageIndex) => {
      const nextPage = mapper(page, pageIndex, sectionIndex, sectionPageIndex);
      pageIndex += 1;
      return nextPage;
    }),
  }));

  return normalizeBook({ ...book, sections });
}

function updateBookLine(book, pageIndex, lineIndex, updater) {
  return mapBookPages(book, (page, currentPageIndex) => {
    if (currentPageIndex !== pageIndex) {
      return page;
    }

    return {
      ...page,
      lines: page.lines.map((line, currentLineIndex) => {
        if (currentLineIndex !== lineIndex) {
          return line;
        }

        return updater(line);
      }),
    };
  });
}

function updateBookSection(book, sectionIndex, updater) {
  return normalizeBook({
    ...book,
    sections: book.sections.map((section, currentSectionIndex) =>
      currentSectionIndex === sectionIndex ? updater(section) : section
    ),
  });
}

function getPageIndexForSectionPage(book, sectionId, sectionPageNumber) {
  return Math.max(
    0,
    book.pages.findIndex(
      (page) =>
        page.sectionId === sectionId &&
        page.sectionPageNumber === sectionPageNumber
    )
  );
}

function getSectionIndexForPage(book, page) {
  const sectionIndex = book.sections.findIndex((section) => section.id === page?.sectionId);
  return Math.max(0, sectionIndex);
}

function getPageIndexForAbsoluteLine(pages, absoluteLineIndex) {
  let skippedLines = 0;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageLineCount = pages[pageIndex].lines.length;

    if (absoluteLineIndex < skippedLines + pageLineCount) {
      return pageIndex;
    }

    skippedLines += pageLineCount;
  }

  return Math.max(0, pages.length - 1);
}

function getLineIndexForAbsoluteLine(pages, absoluteLineIndex) {
  const pageIndex = getPageIndexForAbsoluteLine(pages, absoluteLineIndex);
  const skippedLines = pages
    .slice(0, pageIndex)
    .reduce((count, page) => count + page.lines.length, 0);

  return Math.max(0, absoluteLineIndex - skippedLines);
}

function replaceBookLines(pages, flatLines) {
  return pages.map((page, pageIndex) => ({
    ...page,
    lines: pageIndex === 0 ? flatLines : [],
  }));
}

function prettyPrintJsonText(value) {
  if (!value) {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function createAiBookPdfRequest(book) {
  return {
    book: {
      book: book.book,
      slug: book.slug,
      title: book.title,
      edition: book.edition,
      contentVersion: book.contentVersion,
      pdfSettings: book.pdfSettings,
    },
    sections: book.sections.map((section) => ({
      id: section.id,
      title: section.title,
      prompt: section.prompt,
      sampleJson: section.sampleJson,
      pdfSettings: section.pdfSettings,
      pageCount: section.pages.length,
    })),
  };
}

export default function BookBuilderPanel() {
  const dispatch = useDispatch();
  const score = useSelector((state) => state.score.present.score);
  const tempo = useSelector((state) => state.score.present.tempo);
  const [book, setBook] = useState(createDefaultBook());
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [status, setStatus] = useState("Loading");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSectionDialogOpen, setDeleteSectionDialogOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfDownload, setPdfDownload] = useState({ active: false, label: "", loaded: 0, total: 0 });

  const selectedSection = book.sections[selectedSectionIndex] || book.sections[0];
  const selectedPage = book.pages[selectedPageIndex] || book.pages[0];
  const selectedLine = selectedPage.lines[selectedLineIndex] || selectedPage.lines[0];
  const pdfSettings = normalizePdfSettings(book.pdfSettings);
  const selectedPagePdfSettings = getPagePdfSettings(selectedPage, pdfSettings);
  const linesPerPage = getLinesPerPage(selectedPagePdfSettings);
  const totalSlotCount = book.pages.reduce((count, page) => count + page.lines.length, 0);
  const selectedSectionPages = selectedSection?.pages || [];
  const selectedSectionPageIndex = Math.max(
    0,
    selectedSectionPages.findIndex((page) => page.pageNumber === selectedPage.pageNumber)
  );
  const selectedSectionPageStartIndex = selectedSectionPages
    .slice(0, selectedSectionPageIndex)
    .reduce((count, page) => count + page.lines.length, 0);
  const slotGridColumns = selectedPagePdfSettings.columns === 3 ? 6 : 4;
  const slotGridRows = Math.ceil(linesPerPage / slotGridColumns);

  const filledLineCount = useMemo(
    () => book.pages.flatMap((page) => page.lines).filter((line) => line.score).length,
    [book.pages]
  );

  const loadBook = useCallback(async () => {
    try {
      const response = await fetch("/api/book-builder?includeScores=1", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load book");
      }

      const nextBook = normalizeBook(payload.book);
      setBook(nextBook);
      setSelectedSectionIndex(getSectionIndexForPage(nextBook, nextBook.pages[0]));
      setSelectedPageIndex(0);
      setSelectedLineIndex(0);
      setStatus("Loaded from disk");
    } catch (error) {
      const nextBook = createDefaultBook();
      setBook(nextBook);
      setSelectedSectionIndex(0);
      setSelectedPageIndex(0);
      setSelectedLineIndex(0);
      setStatus("Using blank book");
    }
  }, []);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  useEffect(() => {
    if (selectedPageIndex >= book.pages.length) {
      setSelectedPageIndex(Math.max(0, book.pages.length - 1));
      setSelectedLineIndex(0);
      return;
    }

    const nextSectionIndex = getSectionIndexForPage(book, selectedPage);
    if (nextSectionIndex !== selectedSectionIndex) {
      setSelectedSectionIndex(nextSectionIndex);
    }
  }, [book, selectedPage, selectedPageIndex, selectedSectionIndex]);

  const saveBook = useCallback(async (nextBook, successMessage = "Saved to disk") => {
    setIsSaving(true);

    try {
      const normalizedBook = normalizeBook(nextBook);
      const response = await fetch("/api/book-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ book: normalizedBook }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save book");
      }

      const savedBook = normalizeBook(payload.book);
      setBook(savedBook);
      setStatus(successMessage);
      return savedBook;
    } catch (error) {
      setStatus("Save failed");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const setSelectedLineDraft = useCallback(
    (updates) => {
      setBook((currentBook) =>
        updateBookLine(currentBook, selectedPageIndex, selectedLineIndex, (line) => ({
          ...line,
          ...updates,
        }))
      );
    },
    [selectedLineIndex, selectedPageIndex]
  );

  const saveCurrentScoreToLine = useCallback(() => {
    const now = new Date().toISOString();
    const nextBook = updateBookLine(book, selectedPageIndex, selectedLineIndex, (line) => ({
      ...line,
      title: line.title || `Page ${line.pageNumber}, Line ${line.lineNumber}`,
      tempo,
      score: scoreToBookLine(score),
      updatedAt: now,
    }));

    saveBook(nextBook, `Saved page ${selectedPage.pageNumber}, line ${selectedLine.lineNumber}`);
  }, [book, saveBook, score, selectedLine.lineNumber, selectedLineIndex, selectedPage.pageNumber, selectedPageIndex, tempo]);

  const loadSelectedLineToScore = useCallback(() => {
    const nextScore = selectedLine.score
      ? cloneJson(selectedLine.score)
      : createBlankLineScore();

    dispatch(
      scoreActions.updateScore({
        score: nextScore,
        name: selectedLine.title || `Page ${selectedPage.pageNumber}, Line ${selectedLine.lineNumber}`,
        tempo: selectedLine.tempo || tempo,
        mutations: [],
      })
    );
    setStatus(`Loaded page ${selectedPage.pageNumber}, line ${selectedLine.lineNumber}`);
  }, [dispatch, selectedLine, selectedPage.pageNumber, tempo]);

  const saveMetadata = useCallback(() => {
    saveBook(book, "Saved line details");
  }, [book, saveBook]);

  const deleteSelectedLine = useCallback(() => {
    const nextBook = updateBookLine(book, selectedPageIndex, selectedLineIndex, (line) =>
      createBlankLine(line.pageNumber, line.lineNumber)
    );

    setDeleteDialogOpen(false);
    saveBook(nextBook, `Cleared page ${selectedPage.pageNumber}, line ${selectedLine.lineNumber}`);
  }, [book, saveBook, selectedLine.lineNumber, selectedLineIndex, selectedPage.pageNumber, selectedPageIndex]);

  const insertBlankLineAfter = useCallback(() => {
    const flatLines = selectedSection.pages.flatMap((page) => page.lines);
    const absoluteIndex = selectedSectionPageStartIndex + selectedLineIndex;
    flatLines.splice(absoluteIndex + 1, 0, createBlankLine(1, 1));

    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      pages: renumberPages(replaceBookLines(section.pages, flatLines), section.pdfSettings || pdfSettings),
    }));
    const nextAbsoluteIndex = absoluteIndex + 1;
    const nextSection = nextBook.sections[selectedSectionIndex];
    const nextSectionPageIndex = getPageIndexForAbsoluteLine(nextSection.pages, nextAbsoluteIndex);
    const nextLineIndex = getLineIndexForAbsoluteLine(nextSection.pages, nextAbsoluteIndex);

    setSelectedPageIndex(
      getPageIndexForSectionPage(
        nextBook,
        nextSection.id,
        nextSection.pages[nextSectionPageIndex].sectionPageNumber
      )
    );
    setSelectedLineIndex(nextLineIndex);
    saveBook(nextBook, "Inserted blank line");
  }, [book, pdfSettings, saveBook, selectedLineIndex, selectedSection, selectedSectionIndex, selectedSectionPageStartIndex]);

  const moveSelectedLine = useCallback(
    (direction) => {
      const flatLines = selectedSection.pages.flatMap((page) => page.lines);
      const fromIndex = selectedSectionPageStartIndex + selectedLineIndex;
      const toIndex = fromIndex + direction;

      if (toIndex < 0 || toIndex >= flatLines.length) {
        return;
      }

      const [line] = flatLines.splice(fromIndex, 1);
      flatLines.splice(toIndex, 0, line);

      const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
        ...section,
        pages: renumberPages(replaceBookLines(section.pages, flatLines), section.pdfSettings || pdfSettings),
      }));
      const nextSection = nextBook.sections[selectedSectionIndex];
      const nextSectionPageIndex = getPageIndexForAbsoluteLine(nextSection.pages, toIndex);
      const nextLineIndex = getLineIndexForAbsoluteLine(nextSection.pages, toIndex);

      setSelectedPageIndex(
        getPageIndexForSectionPage(
          nextBook,
          nextSection.id,
          nextSection.pages[nextSectionPageIndex].sectionPageNumber
        )
      );
      setSelectedLineIndex(nextLineIndex);
      saveBook(nextBook, "Moved line");
    },
    [book, pdfSettings, saveBook, selectedLineIndex, selectedSection, selectedSectionIndex, selectedSectionPageStartIndex]
  );

  const addPage = useCallback(() => {
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      pages: [
        ...section.pages,
        createBlankPage(section.pages.length + 1, section.pdfSettings || pdfSettings),
      ],
    }));
    const nextSection = nextBook.sections[selectedSectionIndex];
    const nextSectionPage = nextSection.pages[nextSection.pages.length - 1];

    setSelectedPageIndex(
      getPageIndexForSectionPage(
        nextBook,
        nextSection.id,
        nextSectionPage.sectionPageNumber
      )
    );
    setSelectedLineIndex(0);
    saveBook(nextBook, `Added page to ${nextSection.title}`);
  }, [book, pdfSettings, saveBook, selectedSectionIndex]);

  const updatePagePdfColumns = useCallback((columns) => {
    const nextPagePdfSettings = normalizePdfSettings({
      ...selectedPagePdfSettings,
      columns,
    });
    const selectedSectionPageNumber = selectedPage.sectionPageNumber;
    const sectionId = selectedPage.sectionId;
    const pagesWithUpdatedSettings = selectedSection.pages.map((page) =>
      page.sectionPageNumber === selectedSectionPageNumber
        ? { ...page, pdfSettings: nextPagePdfSettings }
        : page
    );
    const nextLinesPerPage = getLinesPerPage(nextPagePdfSettings);
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      pages: renumberPages(pagesWithUpdatedSettings, section.pdfSettings || pdfSettings),
    }));

    setBook(nextBook);
    setSelectedPageIndex(
      getPageIndexForSectionPage(nextBook, sectionId, selectedSectionPageNumber)
    );
    setSelectedLineIndex((lineIndex) =>
      Math.min(lineIndex, nextLinesPerPage - 1)
    );
    saveBook(
      nextBook,
      `Page ${selectedPage.pageNumber}: ${nextPagePdfSettings.columns} columns / ${nextLinesPerPage} slots`
    );
  }, [book, pdfSettings, saveBook, selectedPage, selectedPagePdfSettings, selectedSection, selectedSectionIndex]);

  const selectSection = useCallback((sectionIndex) => {
    const section = book.sections[sectionIndex];

    if (!section) {
      return;
    }

    setSelectedSectionIndex(sectionIndex);
    setSelectedPageIndex(
      getPageIndexForSectionPage(
        book,
        section.id,
        section.pages[0]?.sectionPageNumber || 1
      )
    );
    setSelectedLineIndex(0);
  }, [book]);

  const updateSelectedSectionDraft = useCallback((updates) => {
    setBook((currentBook) =>
      updateBookSection(currentBook, selectedSectionIndex, (section) => ({
        ...section,
        ...updates,
      }))
    );
  }, [selectedSectionIndex]);

  const saveSectionDetails = useCallback(() => {
    saveBook(book, "Saved section details");
  }, [book, saveBook]);

  const addSection = useCallback(() => {
    const sectionNumber = book.sections.length + 1;
    const title = `Section ${sectionNumber}`;
    const nextSection = createBookSection(sectionNumber, {
      id: createSectionId(title, book.sections),
      title,
      prompt: "",
      sampleJson: "",
    }, pdfSettings);
    const nextBook = normalizeBook({
      ...book,
      sections: [...book.sections, nextSection],
    });
    const nextSectionIndex = nextBook.sections.length - 1;

    setBook(nextBook);
    setSelectedSectionIndex(nextSectionIndex);
    setSelectedPageIndex(
      getPageIndexForSectionPage(
        nextBook,
        nextBook.sections[nextSectionIndex].id,
        1
      )
    );
    setSelectedLineIndex(0);
    saveBook(nextBook, "Added section");
  }, [book, pdfSettings, saveBook]);

  const moveSelectedSection = useCallback((direction) => {
    const toIndex = selectedSectionIndex + direction;

    if (toIndex < 0 || toIndex >= book.sections.length) {
      return;
    }

    const sections = [...book.sections];
    const [section] = sections.splice(selectedSectionIndex, 1);
    sections.splice(toIndex, 0, section);
    const nextBook = normalizeBook({ ...book, sections });

    setBook(nextBook);
    setSelectedSectionIndex(toIndex);
    setSelectedPageIndex(
      getPageIndexForSectionPage(
        nextBook,
        nextBook.sections[toIndex].id,
        1
      )
    );
    setSelectedLineIndex(0);
    saveBook(nextBook, "Moved section");
  }, [book, saveBook, selectedSectionIndex]);

  const deleteSelectedSection = useCallback(() => {
    if (book.sections.length <= 1) {
      return;
    }

    const sections = book.sections.filter((_, sectionIndex) => sectionIndex !== selectedSectionIndex);
    const nextBook = normalizeBook({ ...book, sections });
    const nextSectionIndex = Math.min(selectedSectionIndex, nextBook.sections.length - 1);

    setDeleteSectionDialogOpen(false);
    setBook(nextBook);
    setSelectedSectionIndex(nextSectionIndex);
    setSelectedPageIndex(
      getPageIndexForSectionPage(
        nextBook,
        nextBook.sections[nextSectionIndex].id,
        1
      )
    );
    setSelectedLineIndex(0);
    saveBook(nextBook, "Deleted section");
  }, [book, saveBook, selectedSectionIndex]);

  const uploadSectionJson = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      updateSelectedSectionDraft({ sampleJson: prettyPrintJsonText(text) });
      setStatus(`Loaded JSON sample: ${file.name}`);
    };
    reader.onerror = () => setStatus("JSON upload failed");
    reader.readAsText(file);
  }, [updateSelectedSectionDraft]);

  const saveCurrentScoreToSectionJson = useCallback(() => {
    const sampleJson = JSON.stringify(
      {
        title: selectedSection.title,
        tempo,
        score: scoreToBookLine(score),
      },
      null,
      2
    );
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      sampleJson,
    }));

    setBook(nextBook);
    saveBook(nextBook, `Saved score sample to ${selectedSection.title}`);
  }, [book, saveBook, score, selectedSection.title, selectedSectionIndex, tempo]);

  const downloadPdf = useCallback(async (url, filename, label, options = {}) => {
    setPdfDownload({ active: true, label, loaded: 0, total: 0 });
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? Number(contentLength) : 0;
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        setPdfDownload({ active: true, label, loaded, total });
      }

      const blob = new Blob(chunks, { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      setStatus("PDF downloaded");
      return true;
    } catch (error) {
      setStatus(`Download failed: ${error.message}`);
      return false;
    } finally {
      setPdfDownload({ active: false, label: "", loaded: 0, total: 0 });
    }
  }, []);

  const downloadSelectedPagePdf = useCallback(() => {
    const pad = String(selectedPage.pageNumber).padStart(2, "0");
    downloadPdf(
      `/api/book-builder?format=pdf&page=${selectedPage.pageNumber}`,
      `snare-drum-book-page-${pad}.pdf`,
      `Downloading page ${selectedPage.pageNumber}…`
    );
  }, [downloadPdf, selectedPage.pageNumber]);

  const downloadFullBookPdf = useCallback(() => {
    downloadPdf(
      "/api/book-builder?format=pdf&scope=book",
      "snare-drum-book.pdf",
      "Downloading book PDF…"
    );
  }, [downloadPdf]);

  const downloadAiBookPdf = useCallback(async () => {
    const downloaded = await downloadPdf(
      "/api/book-builder?format=pdf&scope=ai-book",
      "snare-drum-book-ai.pdf",
      "Generating AI book PDF…",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createAiBookPdfRequest(book)),
      }
    );

    if (downloaded) {
      await loadBook();
      setStatus("AI book PDF generated");
    }
  }, [book, downloadPdf, loadBook]);

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Book</span>
          <h2>{book.title}</h2>
          <p>{filledLineCount} saved rhythms / {totalSlotCount} slots</p>
        </div>
        <IconButton icon={<FaSave />} onClick={saveMetadata} title="Save book" variant="iconOnly">
          Save
        </IconButton>
      </header>

      <div className={styles.status}>{isSaving ? "Saving..." : status}</div>

      {pdfDownload.active && (
        <div className={styles.pdfProgress}>
          <div className={styles.pdfProgressLabel}>
            {pdfDownload.label}
            {pdfDownload.total > 0
              ? ` ${Math.round((pdfDownload.loaded / pdfDownload.total) * 100)}%`
              : ""}
          </div>
          <div className={styles.pdfProgressTrack}>
            {pdfDownload.total > 0 ? (
              <div
                className={styles.pdfProgressBar}
                style={{ width: `${Math.round((pdfDownload.loaded / pdfDownload.total) * 100)}%` }}
              />
            ) : (
              <div className={styles.pdfProgressSpin} />
            )}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <IconButton icon={<FaUpload />} onClick={saveCurrentScoreToLine} title="Save current score to selected line" variant="primary">
          Score to line
        </IconButton>
        <IconButton icon={<FaFolderOpen />} onClick={loadSelectedLineToScore} title="Load selected line into score">
          Load line
        </IconButton>
        <IconButton icon={<FaFilePdf />} onClick={downloadSelectedPagePdf} title="Download selected page PDF" disabled={pdfDownload.active}>
          Page PDF
        </IconButton>
        <IconButton icon={<FaFilePdf />} onClick={downloadFullBookPdf} title="Download entire book PDF" disabled={pdfDownload.active}>
          Book PDF
        </IconButton>
        <IconButton icon={<FaMagic />} onClick={downloadAiBookPdf} title="Generate sections from prompts and download the combined PDF" disabled={pdfDownload.active || isSaving}>
          AI book PDF
        </IconButton>
        <IconButton icon={<FaEye />} onClick={() => { setPdfPreviewUrl(`/api/book-builder?format=pdf&inline=1&page=${selectedPage.pageNumber}`); setPdfPreviewOpen(true); }} title="Preview selected page PDF">
          Preview
        </IconButton>
        <IconButton icon={<FaEye />} onClick={() => { setPdfPreviewUrl("/api/book-builder?format=pdf&inline=1&sample=eighth-notes"); setPdfPreviewOpen(true); }} title="Preview eighth note sample">
          8th Sample
        </IconButton>
        <IconButton icon={<FaSave />} onClick={saveMetadata} title="Save line details">
          Save details
        </IconButton>
      </div>

      <section className={styles.sectionManager}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Sections</span>
            <h3>{selectedSection.title}</h3>
          </div>
          <div className={styles.sectionActions}>
            <IconButton icon={<FaPlus />} onClick={addSection} title="Add section" variant="iconOnly">
              Add
            </IconButton>
            <IconButton
              disabled={selectedSectionIndex === 0}
              icon={<FaArrowUp />}
              onClick={() => moveSelectedSection(-1)}
              title="Move section earlier"
              variant="iconOnly"
            >
              Up
            </IconButton>
            <IconButton
              disabled={selectedSectionIndex === book.sections.length - 1}
              icon={<FaArrowDown />}
              onClick={() => moveSelectedSection(1)}
              title="Move section later"
              variant="iconOnly"
            >
              Down
            </IconButton>
            <IconButton
              disabled={book.sections.length <= 1}
              icon={<FaTrash />}
              onClick={() => setDeleteSectionDialogOpen(true)}
              title="Delete section"
              variant="iconOnly"
            >
              Delete
            </IconButton>
          </div>
        </div>

        <div className={styles.sectionTabs}>
          {book.sections.map((section, sectionIndex) => (
            <button
              className={`${styles.sectionTab} ${sectionIndex === selectedSectionIndex ? styles.activeSectionTab : ""}`}
              key={section.id}
              onClick={() => selectSection(sectionIndex)}
              type="button"
            >
              <strong>{section.title}</strong>
              <span>{section.pages.length} pages</span>
            </button>
          ))}
        </div>

        <div className={styles.sectionEditor}>
          <Field label="Section title">
            <input
              onChange={(event) => updateSelectedSectionDraft({ title: event.target.value })}
              value={selectedSection.title}
            />
          </Field>
          <Field label="Local AI prompt">
            <textarea
              onChange={(event) => updateSelectedSectionDraft({ prompt: event.target.value })}
              rows={3}
              value={selectedSection.prompt || ""}
            />
          </Field>
          <Field label="Sample JSON">
            <textarea
              onChange={(event) => updateSelectedSectionDraft({ sampleJson: event.target.value })}
              rows={4}
              value={selectedSection.sampleJson || ""}
            />
          </Field>
          <div className={styles.sectionEditorActions}>
            <label className={styles.uploadButton}>
              <FaUpload />
              <span>Upload JSON</span>
              <input
                accept="application/json,.json"
                onChange={uploadSectionJson}
                type="file"
              />
            </label>
            <IconButton
              icon={<FaBook />}
              onClick={saveCurrentScoreToSectionJson}
              title="Save current score as this section's sample JSON"
            >
              Current score
            </IconButton>
            <IconButton icon={<FaSave />} onClick={saveSectionDetails} title="Save section details">
              Save section
            </IconButton>
          </div>
        </div>
      </section>

      <div className={styles.tabLabel}>All pages</div>
      <div className={styles.pageTabs}>
        {book.pages.map((page, pageIndex) => (
          <button
            className={`${styles.pageTab} ${pageIndex === selectedPageIndex ? styles.activePageTab : ""}`}
            key={page.pageNumber}
            onClick={() => {
              setSelectedSectionIndex(getSectionIndexForPage(book, page));
              setSelectedPageIndex(pageIndex);
              setSelectedLineIndex(0);
            }}
            type="button"
            title={page.sectionTitle ? `${page.sectionTitle}, page ${page.sectionPageNumber}` : `Page ${page.pageNumber}`}
          >
            {page.pageNumber}
          </button>
        ))}
        <button className={styles.pageTab} onClick={addPage} type="button">
          <FaPlus />
        </button>
      </div>

      <div className={styles.tabLabel}>{selectedSection.title} pages</div>
      <div className={styles.sectionPageTabs}>
        {selectedSection.pages.map((page) => (
          <button
            className={`${styles.pageTab} ${page.pageNumber === selectedPage.pageNumber ? styles.activePageTab : ""}`}
            key={`${selectedSection.id}-${page.sectionPageNumber}`}
            onClick={() => {
              setSelectedPageIndex(
                getPageIndexForSectionPage(book, selectedSection.id, page.sectionPageNumber)
              );
              setSelectedLineIndex(0);
            }}
            type="button"
          >
            {page.sectionPageNumber}
          </button>
        ))}
        <button className={styles.pageTab} onClick={addPage} type="button">
          <FaPlus />
        </button>
      </div>

      <div
        className={styles.lineGrid}
        style={{
          gridTemplateColumns: `repeat(${slotGridColumns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${slotGridRows}, minmax(40px, 1fr))`,
        }}
      >
        {selectedPage.lines.map((line, lineIndex) => (
          <button
            className={`${styles.lineSlot} ${lineIndex === selectedLineIndex ? styles.activeLineSlot : ""}`}
            key={`${selectedPage.pageNumber}-${line.lineNumber}`}
            onClick={() => setSelectedLineIndex(lineIndex)}
            type="button"
          >
            <div className={styles.slotHeader}>
              <span>{line.lineNumber}</span>
              <strong>{line.score ? line.title || "Untitled rhythm" : "Blank"}</strong>
            </div>
            <LinePreview line={line} />
          </button>
        ))}
      </div>

      <section className={styles.editor}>
        <div className={styles.editorTitle}>
          <FaBook />
          <h3>
            Page {selectedPage.pageNumber}, Line {selectedLine.lineNumber}
            {selectedPage.sectionTitle ? ` · ${selectedPage.sectionTitle} ${selectedPage.sectionPageNumber}` : ""}
          </h3>
        </div>

        <Field label="Line title">
          <input
            onChange={(event) => setSelectedLineDraft({ title: event.target.value })}
            value={selectedLine.title}
          />
        </Field>

        <Field label="Notes">
          <textarea
            onChange={(event) => setSelectedLineDraft({ notes: event.target.value })}
            rows={2}
            value={selectedLine.notes}
          />
        </Field>

        <div className={styles.smallActions}>
          <IconButton icon={<FaPlus />} onClick={insertBlankLineAfter} title="Insert blank line after selected line">
            Insert
          </IconButton>
          <IconButton icon={<FaEraser />} onClick={() => setDeleteDialogOpen(true)} title="Delete selected line and leave a blank slot">
            Delete
          </IconButton>
        </div>

        <div className={styles.smallActions}>
          <button
            disabled={selectedSectionPageIndex === 0 && selectedLineIndex === 0}
            onClick={() => moveSelectedLine(-1)}
            type="button"
          >
            <FaArrowUp />
            <span>Move up</span>
          </button>
          <button
            disabled={
              selectedSectionPageIndex === selectedSection.pages.length - 1 &&
              selectedLineIndex === selectedPage.lines.length - 1
            }
            onClick={() => moveSelectedLine(1)}
            type="button"
          >
            <FaArrowDown />
            <span>Move down</span>
          </button>
        </div>
      </section>

      <section className={styles.editor}>
        <div className={styles.editorTitle}>
          <h3>Page PDF Settings</h3>
        </div>
        <Field label="Columns">
          <select
            value={selectedPagePdfSettings.columns}
            onChange={(event) => updatePagePdfColumns(Number(event.target.value))}
          >
            {PDF_COLUMN_OPTIONS.map((columns) => (
              <option key={columns} value={columns}>
                {columns} columns
              </option>
            ))}
          </select>
        </Field>
        <Field label="Slots per page">
          <input readOnly value={linesPerPage} />
        </Field>
        <div className={styles.smallActions}>
          <IconButton icon={<FaSave />} onClick={saveMetadata} title="Save PDF settings">
            Save settings
          </IconButton>
        </div>
      </section>

      <Dialog
        isOpen={deleteDialogOpen}
        message={`Clear page ${selectedPage.pageNumber}, line ${selectedLine.lineNumber}? The slot will remain blank.`}
        onCancel={() => setDeleteDialogOpen(false)}
        onOk={deleteSelectedLine}
      />
      <Dialog
        isOpen={deleteSectionDialogOpen}
        message={`Delete "${selectedSection.title}" and all of its pages?`}
        onCancel={() => setDeleteSectionDialogOpen(false)}
        onOk={deleteSelectedSection}
      />
      <MuiDialog
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        maxWidth="xl"
        fullWidth
      >
        <iframe
          src={pdfPreviewUrl}
          style={{ width: "100%", height: "85vh", border: "none", display: "block" }}
          title="PDF Preview"
        />
      </MuiDialog>
    </aside>
  );
}
