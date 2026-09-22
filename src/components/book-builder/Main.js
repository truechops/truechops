import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaEye,
  FaFilePdf,
  FaPlus,
  FaSave,
  FaTrash,
  FaUpload,
} from "react-icons/fa";

import Dialog from "../ui/Dialog";
import { drawScore, initialize } from "../../lib/vexflow";
import {
  ORNAMENT_OPTIONS,
  PDF_PAGE_FOOTER_HEIGHT,
  PDF_PAGE_HEIGHT,
  PDF_PAGE_MARGIN,
  PDF_PAGE_WIDTH,
  SCORE_MEASURE_END_PADDING,
  SCORE_MEASURE_GAP,
  SCORE_MEASURE_START_PADDING,
  SCORE_MINIMUM_NOTE_SPACING,
  SUBDIVISION_OPTIONS,
  TUPLET_TYPE_OPTIONS,
  createContinuousPageScore,
  getLinesPerPage,
  getPagePdfSettings,
  getScoreRenderWidth,
  getSystemsPerPage,
  createBlankPage,
  createBookSection,
  createDefaultBook,
  getPageGenerationSettings,
  normalizePdfSettings,
  normalizePageGenerationSettings,
  normalizeSectionMaxPlayedNotes,
  normalizeSectionMaxSameHandStickingRun,
  normalizeSectionMinPlayedNotes,
  normalizeSectionPageCount,
  normalizeSectionTuplet,
  normalizeSectionTuplets,
  normalizeBook,
  normalizeGlobalOrnamentDensity,
  renumberPages,
} from "./book-data";
import styles from "./BookBuilder.module.css";

const TUPLET_COUNT_OPTIONS = Array.from({ length: 15 }, (_, index) => index + 2);
const DEFAULT_SECTION_TUPLET = { actual: 3, normal: 2, type: 8 };
const COMMON_SECTION_TUPLETS = [
  DEFAULT_SECTION_TUPLET,
  { actual: 3, normal: 2, type: 16 },
  { actual: 5, normal: 4, type: 16 },
  { actual: 7, normal: 4, type: 16 },
  { actual: 5, normal: 4, type: 8 },
];

function getTupletNormalOptions(type) {
  const maxNormalNotes = Number(type) || DEFAULT_SECTION_TUPLET.type;
  return TUPLET_COUNT_OPTIONS.filter((count) => count <= maxNormalNotes);
}

function normalizeTupletPickerUpdate(value) {
  const maxNormalNotes = Number(value.type) || DEFAULT_SECTION_TUPLET.type;

  return normalizeSectionTuplet({
    ...value,
    normal: Math.min(Number(value.normal), maxNormalNotes),
  });
}

function getNextTupletConfig(tuplets) {
  return COMMON_SECTION_TUPLETS.find((candidate) =>
    !tuplets.some((tuplet) =>
      tuplet.actual === candidate.actual &&
      tuplet.normal === candidate.normal &&
      tuplet.type === candidate.type
    )
  ) || {
    ...DEFAULT_SECTION_TUPLET,
    actual: Math.min(16, Math.max(...tuplets.map((tuplet) => tuplet.actual), 2) + 1),
  };
}

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

function CheckboxPicker({ label, onToggle, options, value }) {
  const selectedValues = new Set(value);

  return (
    <div className={styles.fieldGroup}>
      <span>{label}</span>
      <div className={styles.pickerGrid}>
        {options.map((option) => {
          const checked = selectedValues.has(option.id);

          return (
            <label
              className={`${styles.pickerOption} ${checked ? styles.activePickerOption : ""}`}
              key={option.id}
            >
              <input
                checked={checked}
                onChange={() => onToggle(option.id)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
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

function PageLayoutPreview({ page, pdfSettings }) {
  const reactId = useId();
  const renderId = `book-page-layout-preview-${reactId.replace(/:/g, "")}`;
  const [previewSlices, setPreviewSlices] = useState([]);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    const container = document.getElementById(renderId);
    if (!container || !page) {
      return;
    }

    container.innerHTML = "";

    try {
      const normalizedSettings = normalizePdfSettings(pdfSettings);
      const pageScore = createContinuousPageScore(page.lines);

      if (!pageScore) {
        setPreviewSlices([]);
        setPreviewError("This page has no generated rhythms. Save its settings, then regenerate the book.");
        return;
      }

      const { renderer, context } = initialize(renderId);
      drawScore(
        renderer,
        context,
        pageScore,
        null,
        () => {},
        {
          width: getScoreRenderWidth(normalizedSettings),
          scale: 1,
          hResize: 1,
          vResize: 1,
          justifyLastRow: true,
          measureNoteStartPadding: SCORE_MEASURE_START_PADDING,
          measureNoteEndPadding: SCORE_MEASURE_END_PADDING,
          measureGap: SCORE_MEASURE_GAP,
          minimumNoteSpacing: SCORE_MINIMUM_NOTE_SPACING,
          measuresPerLine: normalizedSettings.measuresPerLine,
          hideTimeSignature: false,
          showMeasureNumbers: true,
          systemSpacing: normalizedSettings.lineSpacing,
        },
        { start: [], end: [] }
      );

      const svg = container.querySelector("svg");
      if (!svg) {
        throw new Error("The page could not be drawn.");
      }

      const svgWidth = Number.parseFloat(svg.getAttribute("width"));
      const svgHeight = Number.parseFloat(svg.getAttribute("height"));
      const totalSystems = Math.max(
        1,
        Math.round(svgHeight / normalizedSettings.lineSpacing)
      );
      const systemsPerPage = getSystemsPerPage(normalizedSettings);
      const slices = [];

      for (let systemStart = 0; systemStart < totalSystems; systemStart += systemsPerPage) {
        const systemCount = Math.min(systemsPerPage, totalSystems - systemStart);
        const sliceTop = systemStart * normalizedSettings.lineSpacing;
        const sliceHeight = systemCount * normalizedSettings.lineSpacing;
        const sliceSvg = svg.cloneNode(true);
        sliceSvg.setAttribute("viewBox", `0 ${sliceTop} ${svgWidth} ${sliceHeight}`);
        sliceSvg.setAttribute("width", String(svgWidth));
        sliceSvg.setAttribute("height", String(sliceHeight));
        sliceSvg.setAttribute("preserveAspectRatio", "xMinYMin meet");
        sliceSvg.style.display = "block";
        sliceSvg.style.height = "auto";
        sliceSvg.style.maxWidth = "none";
        sliceSvg.style.width = "100%";

        slices.push({
          key: `${systemStart}-${systemCount}`,
          source: sliceSvg.outerHTML,
        });
      }

      setPreviewSlices(slices);
      setPreviewError("");
    } catch (error) {
      setPreviewSlices([]);
      setPreviewError(error.message || "The page could not be drawn.");
    } finally {
      container.innerHTML = "";
    }
  }, [page, pdfSettings, renderId]);

  const contentLeft = `${(PDF_PAGE_MARGIN / PDF_PAGE_WIDTH) * 100}%`;
  const contentTop = `${(PDF_PAGE_MARGIN / PDF_PAGE_HEIGHT) * 100}%`;
  const contentWidth = `${(
    (PDF_PAGE_WIDTH - PDF_PAGE_MARGIN * 2) / PDF_PAGE_WIDTH
  ) * 100}%`;
  const footerHeight = `${(PDF_PAGE_FOOTER_HEIGHT / PDF_PAGE_HEIGHT) * 100}%`;

  return (
    <div className={styles.livePreview} id="book-live-preview">
      <div aria-hidden="true" className={styles.previewRenderHost} id={renderId} />
      {previewError ? (
        <div className={styles.previewError}>{previewError}</div>
      ) : (
        <div className={styles.previewSheets}>
          {previewSlices.map((slice, sliceIndex) => (
            <div className={styles.previewPaper} key={slice.key}>
              <span className={styles.previewPageNumber}>{page.pageNumber}</span>
              <div
                className={styles.previewScore}
                dangerouslySetInnerHTML={{ __html: slice.source }}
                style={{ left: contentLeft, top: contentTop, width: contentWidth }}
              />
              <div className={styles.previewFooter} style={{ height: footerHeight }}>
                <i aria-label="QR code position" />
              </div>
              {previewSlices.length > 1 && (
                <span className={styles.previewContinuation}>Continuation {sliceIndex + 1}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

function toggleOption(values, optionId, { allowEmpty = true } = {}) {
  const hasOption = values.includes(optionId);
  const nextValues = hasOption
    ? values.filter((value) => value !== optionId)
    : [...values, optionId];

  return !allowEmpty && nextValues.length === 0 ? values : nextValues;
}

function clearGeneratedPageLines(lines = []) {
  return lines.map((line) => ({
    ...line,
    notes: "",
    score: null,
    exerciseShortForm: "",
    updatedAt: null,
  }));
}

export default function BookBuilderPanel() {
  const [book, setBookState] = useState(createDefaultBook());
  const bookRef = useRef(book);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [status, setStatus] = useState("Loading");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteSectionDialogOpen, setDeleteSectionDialogOpen] = useState(false);
  const [pdfDownload, setPdfDownload] = useState({ active: false, label: "", loaded: 0, total: 0 });

  const setBook = useCallback((nextBookOrUpdater) => {
    const nextBook = typeof nextBookOrUpdater === "function"
      ? nextBookOrUpdater(bookRef.current)
      : nextBookOrUpdater;

    bookRef.current = nextBook;
    setBookState(nextBook);
    return nextBook;
  }, []);

  const selectedSection = book.sections[selectedSectionIndex] || book.sections[0];
  const selectedPage = book.pages[selectedPageIndex] || book.pages[0];
  const selectedPageGenerationSettings = getPageGenerationSettings(
    selectedPage,
    selectedSection
  );
  const selectedTuplets = normalizeSectionTuplets(
    selectedPageGenerationSettings.tuplets,
    selectedPageGenerationSettings
  );
  const pdfSettings = normalizePdfSettings(book.pdfSettings);
  const selectedPagePdfSettings = getPagePdfSettings(selectedPage, pdfSettings);
  const linesPerPage = getLinesPerPage(selectedPagePdfSettings);
  const systemsPerPage = getSystemsPerPage(selectedPagePdfSettings);

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
      setStatus("Loaded from disk");
    } catch (error) {
      const nextBook = createDefaultBook();
      setBook(nextBook);
      setSelectedSectionIndex(0);
      setSelectedPageIndex(0);
      setStatus("Using blank book");
    }
  }, [setBook]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  useEffect(() => {
    if (selectedPageIndex >= book.pages.length) {
      setSelectedPageIndex(Math.max(0, book.pages.length - 1));
      return;
    }

    const nextSectionIndex = getSectionIndexForPage(book, selectedPage);
    if (nextSectionIndex !== selectedSectionIndex) {
      setSelectedSectionIndex(nextSectionIndex);
    }
  }, [book, selectedPage, selectedPageIndex, selectedSectionIndex]);

  const saveBook = useCallback(async (
    nextBook,
    successMessage = "Saved to disk",
    saveOptions = {}
  ) => {
    setIsSaving(true);

    try {
      const normalizedBook = normalizeBook(nextBook);
      const response = await fetch("/api/book-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ book: normalizedBook, ...saveOptions }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save book");
      }

      const savedBook = normalizeBook(payload.book);
      setBook((currentBook) => {
        const currentSectionsById = Object.fromEntries(
          (currentBook.sections || []).map((s) => [s.id, s])
        );
        return {
          ...savedBook,
          globalAiRules: currentBook.globalAiRules,
          sections: savedBook.sections.map((section) => ({
            ...section,
            tuplets: currentSectionsById[section.id]?.tuplets ?? section.tuplets,
            minPlayedNotes: currentSectionsById[section.id]?.minPlayedNotes ?? section.minPlayedNotes,
            maxPlayedNotes: currentSectionsById[section.id]?.maxPlayedNotes ?? section.maxPlayedNotes,
            playEveryNote: currentSectionsById[section.id]?.playEveryNote ?? section.playEveryNote,
            maxSameHandStickingRun: currentSectionsById[section.id]?.maxSameHandStickingRun ?? section.maxSameHandStickingRun,
            requiredSameHandStickingRuns: currentSectionsById[section.id]?.requiredSameHandStickingRuns ?? section.requiredSameHandStickingRuns,
          })),
        };
      });
      setStatus(successMessage);
      return savedBook;
    } catch (error) {
      setStatus("Save failed");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [setBook]);

  const saveMetadata = useCallback(() => {
    saveBook(bookRef.current, "Saved page settings");
  }, [saveBook]);

  const updateGlobalOrnamentDensity = useCallback((value) => {
    setBook((currentBook) => ({
      ...currentBook,
      globalOrnamentDensity: normalizeGlobalOrnamentDensity(value),
    }));
    setStatus("Global ornament density updated. Save the book to keep it.");
  }, [setBook]);

  const addPage = useCallback(() => {
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      pageCount: Math.max(
        normalizeSectionPageCount(section.pageCount, section.pages.length),
        section.pages.length + 1
      ),
      pages: [
        ...section.pages,
        createBlankPage(
          section.pages.length + 1,
          section.pages[section.pages.length - 1]?.pdfSettings || section.pdfSettings || pdfSettings,
          getPageGenerationSettings(
            section.pages[section.pages.length - 1],
            section
          )
        ),
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
    saveBook(nextBook, `Added page to ${nextSection.title}`);
  }, [book, pdfSettings, saveBook, selectedSectionIndex]);

  const updatePagePdfSetting = useCallback((setting, value) => {
    const nextPagePdfSettings = normalizePdfSettings({
      ...selectedPagePdfSettings,
      [setting]: value,
    });
    const selectedSectionPageNumber = selectedPage.sectionPageNumber;
    const sectionId = selectedPage.sectionId;
    const pagesWithUpdatedSettings = selectedSection.pages.map((page) =>
      page.sectionPageNumber === selectedSectionPageNumber
        ? { ...page, pdfSettings: nextPagePdfSettings }
        : page
    );
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      pages: renumberPages(pagesWithUpdatedSettings, section.pdfSettings || pdfSettings),
    }));
    const nextSection = nextBook.sections.find((section) => section.id === sectionId);
    const targetSectionPageNumber = Math.min(
      selectedSectionPageNumber,
      nextSection?.pages.length || 1
    );

    setBook(nextBook);
    setSelectedPageIndex(
      getPageIndexForSectionPage(nextBook, sectionId, targetSectionPageNumber)
    );
    setStatus(`Page layout updated in the live preview. Save settings to keep it.`);
  }, [book, pdfSettings, selectedPage, selectedPagePdfSettings, selectedSection, selectedSectionIndex, setBook]);

  const updateSelectedPageDraft = useCallback((updates) => {
    setBook((currentBook) =>
      mapBookPages(currentBook, (page, pageIndex) =>
        pageIndex === selectedPageIndex ? { ...page, ...updates } : page
      )
    );
  }, [selectedPageIndex, setBook]);

  const updateSelectedPageGenerationDraft = useCallback((updates) => {
    setBook((currentBook) =>
      mapBookPages(currentBook, (page, pageIndex) =>
        pageIndex === selectedPageIndex
          ? {
              ...page,
              generationSettings: normalizePageGenerationSettings(
                {
                  ...getPageGenerationSettings(page, selectedSection),
                  ...updates,
                },
                selectedSection
              ),
              lines: clearGeneratedPageLines(page.lines),
            }
          : page
      )
    );
    setStatus("Page rhythm settings updated. Existing rhythms cleared; save, then regenerate them.");
  }, [selectedPageIndex, selectedSection, setBook]);

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
  }, [book]);

  const updateSelectedSectionDraft = useCallback((updates) => {
    setBook((currentBook) =>
      updateBookSection(currentBook, selectedSectionIndex, (section) => ({
        ...section,
        ...updates,
      }))
    );
  }, [selectedSectionIndex, setBook]);

  const addSection = useCallback(() => {
    const sectionNumber = book.sections.length + 1;
    const title = `Section ${sectionNumber}`;
    const nextSection = createBookSection(sectionNumber, {
      id: createSectionId(title, book.sections),
      title,
      prompt: "",
      subdivisions: ["eighths"],
      ornaments: [],
      tuplets: [],
      maxPlayedNotes: normalizeSectionMaxPlayedNotes(),
      playEveryNote: false,
      maxSameHandStickingRun: normalizeSectionMaxSameHandStickingRun(),
      requiredSameHandStickingRuns: [],
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
    saveBook(nextBook, "Deleted section");
  }, [book, saveBook, selectedSectionIndex]);

  const uploadPageJson = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      updateSelectedPageGenerationDraft({ sampleJson: prettyPrintJsonText(text) });
      setStatus(`Loaded JSON sample: ${file.name}`);
    };
    reader.onerror = () => setStatus("JSON upload failed");
    reader.readAsText(file);
  }, [updateSelectedPageGenerationDraft]);

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

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Book</span>
          <h2>{book.title}</h2>
          <p>{filledLineCount} generated rhythms · this page fills with {linesPerPage}</p>
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
        <IconButton icon={<FaFilePdf />} onClick={downloadSelectedPagePdf} title="Download selected page PDF" disabled={pdfDownload.active}>
          Page PDF
        </IconButton>
        <IconButton icon={<FaFilePdf />} onClick={downloadFullBookPdf} title="Download entire book PDF" disabled={pdfDownload.active}>
          Book PDF
        </IconButton>
        <IconButton
          icon={<FaEye />}
          onClick={() => document.getElementById("book-live-preview")?.scrollIntoView({ behavior: "smooth" })}
          title="Jump to the live page preview"
        >
          Live preview
        </IconButton>
        <IconButton icon={<FaSave />} onClick={saveMetadata} title="Save page settings" variant="primary">
          Save page
        </IconButton>
      </div>

      <section className={styles.editor}>
        <div className={styles.editorTitle}>
          <h3>Book settings</h3>
        </div>
        <Field label="Global ornament density (%)">
          <input
            inputMode="numeric"
            min="25"
            max="200"
            onChange={(event) => updateGlobalOrnamentDensity(event.target.value)}
            step="5"
            type="number"
            value={book.globalOrnamentDensity}
          />
        </Field>
        <p className={styles.layoutSummary}>
          100% is the normal ornament frequency. This setting applies to every page the next time rhythms are generated.
        </p>
      </section>

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
              <span>
                {section.pages.length} configured {section.pages.length === 1 ? "page" : "pages"}
              </span>
            </button>
          ))}
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
              }}
              title={`Book page ${page.pageNumber}`}
              type="button"
            >
              {page.sectionPageNumber}
            </button>
          ))}
          <button className={styles.pageTab} onClick={addPage} title="Add page" type="button">
            <FaPlus />
          </button>
        </div>

        <div className={styles.sectionEditor}>
          <Field label="Section title">
            <input
              onChange={(event) => updateSelectedSectionDraft({ title: event.target.value })}
              value={selectedSection.title}
            />
          </Field>
          <div className={styles.editorTitle}>
            <h3>Page {selectedPage.pageNumber} rhythm generation</h3>
          </div>
          <Field label="Page title">
            <input
              onChange={(event) => updateSelectedPageDraft({ title: event.target.value })}
              value={selectedPage.title || ""}
            />
          </Field>
          <Field label="Measures per line">
            <input
              inputMode="numeric"
              min="1"
              max="8"
              onChange={(event) =>
                updatePagePdfSetting("measuresPerLine", event.target.value)
              }
              type="number"
              value={selectedPagePdfSettings.measuresPerLine}
            />
          </Field>
          <Field label="Line spacing">
            <input
              inputMode="decimal"
              min="90"
              max="240"
              onChange={(event) =>
                updatePagePdfSetting("lineSpacing", event.target.value)
              }
              step="2"
              type="number"
              value={selectedPagePdfSettings.lineSpacing}
            />
          </Field>
          <Field label="Note size (%)">
            <input
              inputMode="decimal"
              min="60"
              max="160"
              onChange={(event) =>
                updatePagePdfSetting("noteSize", event.target.value)
              }
              step="5"
              type="number"
              value={selectedPagePdfSettings.noteSize}
            />
          </Field>
          <p className={styles.layoutSummary}>
            This page generates {linesPerPage} rhythms automatically: {systemsPerPage} staff lines × {selectedPagePdfSettings.measuresPerLine} measures.
          </p>
          <Field label="Minimum played notes">
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) =>
                updateSelectedPageGenerationDraft({
                  minPlayedNotes: normalizeSectionMinPlayedNotes(event.target.value),
                })
              }
              type="number"
              value={selectedPageGenerationSettings.minPlayedNotes}
            />
          </Field>
          <Field label="Maximum played notes">
            <input
              disabled={selectedPageGenerationSettings.playEveryNote}
              inputMode="numeric"
              min="0"
              onChange={(event) =>
                updateSelectedPageGenerationDraft({
                  maxPlayedNotes: normalizeSectionMaxPlayedNotes(event.target.value),
                })
              }
              type="number"
              value={selectedPageGenerationSettings.maxPlayedNotes}
            />
          </Field>
          <label className={styles.toggleField}>
            <input
              checked={selectedPageGenerationSettings.playEveryNote}
              onChange={(event) =>
                updateSelectedPageGenerationDraft({ playEveryNote: event.target.checked })
              }
              type="checkbox"
            />
            <span>No rests — play every note</span>
          </label>
          <Field label="Max same-hand stickings">
            <input
              inputMode="numeric"
              min="1"
              onChange={(event) =>
                updateSelectedPageGenerationDraft({
                  maxSameHandStickingRun: normalizeSectionMaxSameHandStickingRun(event.target.value),
                })
              }
              type="number"
              value={selectedPageGenerationSettings.maxSameHandStickingRun}
            />
          </Field>
          <CheckboxPicker
            label="Required same-hand run lengths (OR; unchecked lengths stay random)"
            onToggle={(runLength) =>
              updateSelectedPageGenerationDraft({
                requiredSameHandStickingRuns: toggleOption(
                  selectedPageGenerationSettings.requiredSameHandStickingRuns,
                  runLength
                ).sort((left, right) => left - right),
              })
            }
            options={Array.from(
              {
                length: selectedPageGenerationSettings.maxSameHandStickingRun,
              },
              (_, index) => ({ id: index + 1, label: String(index + 1) })
            )}
            value={selectedPageGenerationSettings.requiredSameHandStickingRuns}
          />
          <div className={styles.tupletEditor}>
            <div className={styles.tupletEditorHeader}>
              <span>Tuplet types</span>
              <button
                className={styles.button}
                onClick={() =>
                  updateSelectedPageGenerationDraft({
                    tuplets: [...selectedTuplets, getNextTupletConfig(selectedTuplets)],
                  })
                }
                type="button"
              >
                <FaPlus /> Add tuplet
              </button>
            </div>
            {selectedTuplets.map((tuplet, tupletIndex) => (
              <div className={styles.tupletRow} key={`${tuplet.actual}-${tuplet.normal}-${tuplet.type}-${tupletIndex}`}>
                <Field label="Actual notes">
                  <select
                    onChange={(event) =>
                      updateSelectedPageGenerationDraft({
                        tuplets: selectedTuplets.map((candidate, index) =>
                          index === tupletIndex
                            ? normalizeTupletPickerUpdate({
                                ...candidate,
                                actual: Number(event.target.value),
                              })
                            : candidate
                        ),
                      })
                    }
                    value={tuplet.actual}
                  >
                    {TUPLET_COUNT_OPTIONS.map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Normal notes">
                  <select
                    onChange={(event) =>
                      updateSelectedPageGenerationDraft({
                        tuplets: selectedTuplets.map((candidate, index) =>
                          index === tupletIndex
                            ? normalizeTupletPickerUpdate({
                                ...candidate,
                                normal: Number(event.target.value),
                              })
                            : candidate
                        ),
                      })
                    }
                    value={tuplet.normal}
                  >
                    {getTupletNormalOptions(tuplet.type).map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Note type">
                  <select
                    onChange={(event) =>
                      updateSelectedPageGenerationDraft({
                        tuplets: selectedTuplets.map((candidate, index) =>
                          index === tupletIndex
                            ? normalizeTupletPickerUpdate({
                                ...candidate,
                                type: Number(event.target.value),
                              })
                            : candidate
                        ),
                      })
                    }
                    value={tuplet.type}
                  >
                    {TUPLET_TYPE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.type}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  aria-label={`Remove tuplet ${tupletIndex + 1}`}
                  className={`${styles.button} ${styles.danger}`}
                  onClick={() =>
                    updateSelectedPageGenerationDraft({
                      tuplets: selectedTuplets.filter((_, index) => index !== tupletIndex),
                    })
                  }
                  title="Remove tuplet"
                  type="button"
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
          <CheckboxPicker
            label="Subdivisions"
            onToggle={(optionId) =>
              updateSelectedPageGenerationDraft({
                subdivisions: toggleOption(
                  selectedPageGenerationSettings.subdivisions,
                  optionId,
                  { allowEmpty: selectedTuplets.length > 0 }
                ),
              })
            }
            options={SUBDIVISION_OPTIONS}
            value={selectedPageGenerationSettings.subdivisions}
          />
          <CheckboxPicker
            label="Ornaments"
            onToggle={(optionId) =>
              updateSelectedPageGenerationDraft({
                ornaments: toggleOption(
                  selectedPageGenerationSettings.ornaments,
                  optionId
                ),
              })
            }
            options={ORNAMENT_OPTIONS}
            value={selectedPageGenerationSettings.ornaments}
          />
          <Field label="Sample JSON">
            <textarea
              onChange={(event) =>
                updateSelectedPageGenerationDraft({ sampleJson: event.target.value })
              }
              rows={4}
              value={selectedPageGenerationSettings.sampleJson || ""}
            />
          </Field>
          <div className={styles.sectionEditorActions}>
            <label className={styles.uploadButton}>
              <FaUpload />
              <span>Upload JSON</span>
              <input
                accept="application/json,.json"
                onChange={uploadPageJson}
                type="file"
              />
            </label>
            <IconButton icon={<FaSave />} onClick={saveMetadata} title="Save page generation settings">
              Save page
            </IconButton>
          </div>
        </div>
      </section>

      <section className={styles.editor}>
        <div className={styles.editorTitle}>
          <h3>Live Printed-Page Preview</h3>
        </div>
        <PageLayoutPreview page={selectedPage} pdfSettings={selectedPagePdfSettings} />
      </section>

      <Dialog
        isOpen={deleteSectionDialogOpen}
        message={`Delete "${selectedSection.title}" and all of its pages?`}
        onCancel={() => setDeleteSectionDialogOpen(false)}
        onOk={deleteSelectedSection}
      />
    </aside>
  );
}
