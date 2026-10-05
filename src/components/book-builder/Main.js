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
  normalizeBook,
  normalizeGlobalOrnamentDensity,
  renumberPages,
} from "./book-data";
import styles from "./BookBuilder.module.css";
import {
  NestedTupletPlanEditor,
  OrnamentTopicsEditor,
  PagePlanSummary,
  SecondaryRowsEditor,
  SecondaryOrnamentGrid,
} from "./ExercisePlanEditors";
import {
  MAX_SUBSECTION_PAGES,
  groupSubsectionPages,
  normalizeRhythmSpan,
  normalizeStickingTail,
  normalizeSubsectionPageCount,
  rhythmSpanLabel,
} from "../../lib/book-structure";

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

function RhythmPoolEditor({ label, value, onChange, primary = false }) {
  const tuplets = value.tuplets;
  const updateTuplet = (index, field, nextValue) => onChange({
    ...value,
    tuplets: tuplets.map((item, i) => i === index
      ? normalizeTupletPickerUpdate({ ...item, [field]: Number(nextValue) })
      : item),
  });

  return (
    <fieldset className={styles.rhythmPool}>
      <legend>{label}</legend>
      <p className={styles.layoutSummary}>
        {primary
          ? "Every exercise must contain each selected primary rhythm. These choices apply to all subsections."
          : "Optional rhythms chosen at random to fill the space around the primary rhythms. Leave empty to use only primary rhythms. If a rhythm is in both pools, its primary settings apply."}
      </p>
      <CheckboxPicker
        label="Subdivisions"
        options={SUBDIVISION_OPTIONS}
        value={value.subdivisions}
        onToggle={(id) => onChange({
          ...value,
          subdivisions: toggleOption(value.subdivisions, id, {
            allowEmpty: !primary || tuplets.length > 0,
          }),
        })}
      />
      <div className={styles.tupletEditor}>
        <div className={styles.tupletEditorHeader}>
          <span>Tuplets</span>
          <button
            className={styles.button}
            type="button"
            onClick={() => onChange({ ...value, tuplets: [...tuplets, getNextTupletConfig(tuplets)] })}
          >
            <FaPlus /> Add tuplet
          </button>
        </div>
        {tuplets.map((tuplet, index) => (
          <div className={styles.tupletRow} key={index}>
            {[
              { key: "actual", label: "Actual notes", options: TUPLET_COUNT_OPTIONS.map((n) => ({ value: n, label: n })) },
              { key: "normal", label: "Normal notes", options: getTupletNormalOptions(tuplet.type).map((n) => ({ value: n, label: n })) },
              { key: "type", label: "Note type", options: TUPLET_TYPE_OPTIONS.map((option) => ({ value: option.type, label: option.label })) },
            ].map((field) => (
              <Field key={field.key} label={field.label}>
                <select
                  value={tuplet[field.key]}
                  onChange={(event) => updateTuplet(index, field.key, event.target.value)}
                >
                  {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
            ))}
            <button
              className={`${styles.button} ${styles.danger}`}
              type="button"
              aria-label={`Remove ${label.toLowerCase()} tuplet ${index + 1}`}
              disabled={primary && !value.subdivisions.length && tuplets.length === 1}
              onClick={() => onChange({ ...value, tuplets: tuplets.filter((_, i) => i !== index) })}
            >
              <FaTrash />
            </button>
          </div>
        ))}
      </div>
      {!primary && <SecondaryOrnamentGrid pool={value} onChange={onChange} />}
    </fieldset>
  );
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

function getPageIndexForSubsection(book, subsectionId, subsectionPageNumber = 1) {
  return Math.max(
    0,
    book.pages.findIndex(
      (page) =>
        page.subsectionId === subsectionId &&
        page.subsectionPageNumber === subsectionPageNumber
    )
  );
}

function pageRangeLabel(pages) {
  const first = pages[0].pageNumber;
  const last = pages[pages.length - 1].pageNumber;
  return first === last ? `Page ${first}` : `Pages ${first}\u2013${last}`;
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
  const [deleteSubsectionDialogOpen, setDeleteSubsectionDialogOpen] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
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
  const selectedGroup = book.groups.find((group) => group.id === selectedSection.groupId) || book.groups[0];
  const groupSections = book.sections.filter((section) => section.groupId === selectedGroup.id);
  const selectedPage = book.pages[selectedPageIndex] || book.pages[0];
  const selectedSubsectionPages = selectedSection.pages.filter(
    (page) => page.subsectionId === selectedPage.subsectionId
  );
  const subsectionCount = groupSubsectionPages(selectedSection.pages).length;
  const selectedPageGenerationSettings = getPageGenerationSettings(
    selectedPage,
    selectedSection
  );
  const nestedStagesActive = Boolean(selectedPageGenerationSettings.nestedTupletPlan && selectedPageGenerationSettings.nestedTupletStages);
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
      setBook(normalizedBook);
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
      setBook((currentBook) => currentBook === normalizedBook ? savedBook : currentBook);
      setStatus(successMessage);
      return savedBook;
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
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
    const subsections = groupSubsectionPages(selectedSection.pages);
    const template = subsections[subsections.length - 1]?.[0];
    const subsectionId = createSectionId(
      `${selectedSection.id}-topic`,
      subsections.map(([page]) => ({ id: page.subsectionId }))
    );
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      pageCount: Math.max(
        normalizeSectionPageCount(section.pageCount, section.pages.length),
        section.pages.length + 1
      ),
      pages: [
        ...section.pages,
        {
          ...createBlankPage(
            section.pages.length + 1,
            template?.pdfSettings || section.pdfSettings || pdfSettings,
            getPageGenerationSettings(template, section)
          ),
          title: `Subsection ${subsections.length + 1}`,
          subsectionId,
          subsectionPageCount: 1,
        },
      ],
    }));

    setSelectedPageIndex(getPageIndexForSubsection(nextBook, subsectionId));
    saveBook(nextBook, `Added subsection to ${selectedSection.title}`);
  }, [book, pdfSettings, saveBook, selectedSection, selectedSectionIndex]);

  const updateSubsectionPageCount = useCallback((value) => {
    const subsectionPageCount = normalizeSubsectionPageCount(value);
    const { subsectionId } = selectedPage;
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      pages: section.pages.map((page) =>
        page.subsectionId === subsectionId ? { ...page, subsectionPageCount } : page
      ),
    }));

    setBook(nextBook);
    setSelectedPageIndex(getPageIndexForSubsection(
      nextBook,
      subsectionId,
      Math.min(selectedPage.subsectionPageNumber || 1, subsectionPageCount)
    ));
    setStatus(`Subsection now spans ${subsectionPageCount} ${subsectionPageCount === 1 ? "page" : "pages"}. Save settings to keep it.`);
  }, [book, selectedPage, selectedSectionIndex, setBook]);

  const updatePagePdfSetting = useCallback((setting, value) => {
    const nextPagePdfSettings = normalizePdfSettings({
      ...selectedPagePdfSettings,
      [setting]: value,
    });
    const { subsectionId, subsectionPageNumber } = selectedPage;
    const pagesWithUpdatedSettings = selectedSection.pages.map((page) =>
      page.subsectionId === subsectionId
        ? { ...page, pdfSettings: nextPagePdfSettings }
        : page
    );
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({
      ...section,
      pages: renumberPages(pagesWithUpdatedSettings, section.pdfSettings || pdfSettings),
    }));

    setBook(nextBook);
    setSelectedPageIndex(
      getPageIndexForSubsection(nextBook, subsectionId, subsectionPageNumber)
    );
    setStatus(`Page layout updated in the live preview. Save settings to keep it.`);
  }, [book, pdfSettings, selectedPage, selectedPagePdfSettings, selectedSection, selectedSectionIndex, setBook]);

  // Subsection settings live on every one of its pages.
  const updateSelectedPageDraft = useCallback((updates) => {
    setBook((currentBook) =>
      mapBookPages(currentBook, (page) =>
        page.subsectionId === selectedPage.subsectionId ? { ...page, ...updates } : page
      )
    );
  }, [selectedPage.subsectionId, setBook]);

  const updateSelectedPageGenerationDraft = useCallback((updates) => {
    setBook((currentBook) =>
      mapBookPages(currentBook, (page) =>
        page.subsectionId === selectedPage.subsectionId
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
    setStatus("Subsection rhythm settings updated. Existing rhythms cleared; save, then regenerate them.");
  }, [selectedPage.subsectionId, selectedSection, setBook]);

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

  const updateSectionRhythms = (field, value) => {
    setBook((currentBook) => updateBookSection(currentBook, selectedSectionIndex, (section) => ({
      ...section,
      [field]: value,
      pages: section.pages.map((page) => ({ ...page, lines: clearGeneratedPageLines(page.lines) })),
    })));
    setStatus("Section rhythms updated. Save, then regenerate the subsections.");
  };

  const updateGroup = (updates) => {
    const nextBook = normalizeBook({
      ...book,
      groups: book.groups.map((group) => group.id === selectedGroup.id ? { ...group, ...updates } : group),
      sections: book.sections.map((section) => updates.rhythmSpan && section.groupId === selectedGroup.id
        ? { ...section, pages: section.pages.map((page) => ({ ...page, lines: clearGeneratedPageLines(page.lines) })) }
        : section),
    });
    setBook(nextBook);
    setStatus(updates.rhythmSpan ? "Span updated for this group. Save, then regenerate its pages." : "Group title updated. Save to keep it.");
  };

  const addGroup = (duplicate = false) => {
    const id = createSectionId("span-group", book.groups);
    const title = duplicate ? `${selectedGroup.title} copy` : "New span group";
    const group = { id, title, rhythmSpan: { ...selectedGroup.rhythmSpan } };
    const sections = duplicate ? groupSections.map((section, index) => ({
      ...section,
      id: `${id}-section-${index + 1}`,
      groupId: id,
      pages: section.pages.map((page) => ({
        ...page, subsectionId: `${id}-section-${index + 1}-topic-${page.subsectionNumber}`,
        lines: clearGeneratedPageLines(page.lines),
      })),
    })) : [createBookSection(book.sections.length + 1, {
      id: `${id}-section-1`, groupId: id, title: "New section",
      primaryRhythms: { subdivisions: ["sixteenths"], tuplets: [], ornaments: [] },
    }, pdfSettings)];
    const nextBook = normalizeBook({ ...book, groups: [...book.groups, group], sections: [...book.sections, ...sections] });
    const sectionIndex = nextBook.sections.findIndex((section) => section.groupId === id);
    setSelectedSectionIndex(sectionIndex);
    setSelectedPageIndex(getPageIndexForSectionPage(nextBook, nextBook.sections[sectionIndex].id, 1));
    saveBook(nextBook, duplicate ? "Duplicated span group" : "Added span group");
  };

  const deleteGroup = () => {
    const nextBook = normalizeBook({ ...book,
      groups: book.groups.filter((group) => group.id !== selectedGroup.id),
      sections: book.sections.filter((section) => section.groupId !== selectedGroup.id),
    });
    setDeleteGroupDialogOpen(false);
    setSelectedSectionIndex(0);
    setSelectedPageIndex(0);
    saveBook(nextBook, "Deleted span group");
  };

  const changeSubsectionOrder = (direction, remove = false) => {
    const subsections = groupSubsectionPages(selectedSection.pages);
    const from = selectedPage.subsectionNumber - 1;
    const [subsection] = subsections.splice(from, 1);
    if (!remove) subsections.splice(from + direction, 0, subsection);
    const nextBook = updateBookSection(book, selectedSectionIndex, (section) => ({ ...section, pages: subsections.flat() }));
    const index = Math.max(0, Math.min(from + direction, subsections.length - 1));
    setBook(nextBook);
    setSelectedPageIndex(getPageIndexForSubsection(nextBook, subsections[index][0].subsectionId));
    setDeleteSubsectionDialogOpen(false);
    saveBook(nextBook, remove ? "Deleted subsection" : "Moved subsection");
  };

  const addSection = useCallback(() => {
    const sectionNumber = book.sections.length + 1;
    const title = `Section ${sectionNumber}`;
    const nextSection = createBookSection(sectionNumber, {
      id: createSectionId(title, book.sections),
      groupId: selectedGroup.id,
      title,
      primaryRhythms: { subdivisions: ["eighths"], tuplets: [], ornaments: [] },
      secondaryRhythms: { subdivisions: [], tuplets: [], ornaments: [] },
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
    const nextSectionIndex = nextBook.sections.findIndex((section) => section.id === nextSection.id);

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
  }, [book, pdfSettings, saveBook, setBook, selectedGroup.id]);

  const moveSelectedSection = useCallback((direction) => {
    const toIndex = selectedSectionIndex + direction;

    if (toIndex < 0 || toIndex >= book.sections.length || book.sections[toIndex].groupId !== selectedGroup.id) {
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
  }, [book, saveBook, selectedSectionIndex, setBook, selectedGroup.id]);

  const deleteSelectedSection = useCallback(() => {
    if (groupSections.length <= 1) {
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
  }, [book, saveBook, selectedSectionIndex, setBook, groupSections.length]);

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
          <h3>Rhythmic span groups</h3>
          <div className={styles.sectionActions}>
            <IconButton icon={<FaPlus />} onClick={() => addGroup()}>Add group</IconButton>
            <IconButton icon={<FaPlus />} onClick={() => addGroup(true)}>Duplicate group</IconButton>
            <IconButton icon={<FaTrash />} disabled={book.groups.length === 1} onClick={() => setDeleteGroupDialogOpen(true)}>Delete group</IconButton>
          </div>
        </div>
        <div className={styles.sectionTabs}>
          {book.groups.map((group) => (
            <button key={group.id} type="button"
              className={`${styles.sectionTab} ${group.id === selectedGroup.id ? styles.activeSectionTab : ""}`}
              onClick={() => selectSection(book.sections.findIndex((section) => section.groupId === group.id))}>
              <strong>{group.title}</strong><span>{rhythmSpanLabel(group.rhythmSpan)}</span>
            </button>
          ))}
        </div>
        <Field label="Span group title"><input value={selectedGroup.title} onChange={(event) => updateGroup({ title: event.target.value })} /></Field>
        <div className={styles.layoutControls}>
          <Field label="Span count"><input type="number" min="1" max={selectedGroup.rhythmSpan.unit}
            value={selectedGroup.rhythmSpan.count}
            onChange={(event) => updateGroup({ rhythmSpan: normalizeRhythmSpan({ ...selectedGroup.rhythmSpan, count: event.target.value }) })} /></Field>
          <Field label="Span note value"><select value={selectedGroup.rhythmSpan.unit}
            onChange={(event) => updateGroup({ rhythmSpan: normalizeRhythmSpan({ ...selectedGroup.rhythmSpan, unit: event.target.value }) })}>
            {[{ value: 1, label: "Whole" }, { value: 2, label: "Half" }, { value: 4, label: "Quarter" }, { value: 8, label: "Eighth" }, { value: 16, label: "Sixteenth" }, { value: 32, label: "Thirty-second" }].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></Field>
        </div>
        <p className={styles.layoutSummary}>Primary groups keep their note count and stretch across this span. For example, 1 quarter and 2 eighths have the same length; four notes over 3 sixteenths form a 4:3 group. Secondary rhythms fill the remaining space in 4/4.</p>
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
              disabled={selectedSection.id === groupSections[0]?.id}
              icon={<FaArrowUp />}
              onClick={() => moveSelectedSection(-1)}
              title="Move section earlier"
              variant="iconOnly"
            >
              Up
            </IconButton>
            <IconButton
              disabled={selectedSection.id === groupSections[groupSections.length - 1]?.id}
              icon={<FaArrowDown />}
              onClick={() => moveSelectedSection(1)}
              title="Move section later"
              variant="iconOnly"
            >
              Down
            </IconButton>
            <IconButton
              disabled={groupSections.length <= 1}
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
          {book.sections.map((section, sectionIndex) => section.groupId === selectedGroup.id && (
            <button
              className={`${styles.sectionTab} ${sectionIndex === selectedSectionIndex ? styles.activeSectionTab : ""}`}
              key={section.id}
              onClick={() => selectSection(sectionIndex)}
              type="button"
            >
              <strong>{section.title}</strong>
              <span>
                {groupSubsectionPages(section.pages).length} {groupSubsectionPages(section.pages).length === 1 ? "subsection" : "subsections"}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.tabLabel}>{selectedSection.title} subsections</div>
        <div className={styles.sectionPageTabs}>
          {groupSubsectionPages(selectedSection.pages).map((pages) => (
            <button
              className={`${styles.pageTab} ${pages[0].subsectionId === selectedPage.subsectionId ? styles.activePageTab : ""}`}
              key={pages[0].subsectionId}
              onClick={() => {
                setSelectedPageIndex(getPageIndexForSubsection(book, pages[0].subsectionId));
              }}
              title={`Book ${pageRangeLabel(pages).toLowerCase()}`}
              type="button"
            >
              <strong>{pages[0].title}</strong><span>{pageRangeLabel(pages)}</span>
            </button>
          ))}
          <button className={styles.pageTab} onClick={addPage} title="Add subsection" type="button">
            <FaPlus /> Add subsection
          </button>
        </div>

        <div className={styles.sectionEditor}>
          <Field label="Section title">
            <input
              onChange={(event) => updateSelectedSectionDraft({ title: event.target.value })}
              value={selectedSection.title}
            />
          </Field>
          <RhythmPoolEditor label="Primary rhythms" value={selectedSection.primaryRhythms} primary
            onChange={(value) => updateSectionRhythms("primaryRhythms", value)} />
          <RhythmPoolEditor label="Secondary rhythms" value={selectedSection.secondaryRhythms}
            onChange={(value) => updateSectionRhythms("secondaryRhythms", value)} />
          <div className={styles.editorTitle}>
            <h3>Subsection · {pageRangeLabel(selectedSubsectionPages).toLowerCase()}</h3>
          </div>
          <div className={styles.sectionActions}>
            <IconButton icon={<FaArrowUp />} disabled={selectedPage.subsectionNumber === 1} onClick={() => changeSubsectionOrder(-1)}>Move earlier</IconButton>
            <IconButton icon={<FaArrowDown />} disabled={selectedPage.subsectionNumber === subsectionCount} onClick={() => changeSubsectionOrder(1)}>Move later</IconButton>
            <IconButton icon={<FaTrash />} disabled={subsectionCount === 1} onClick={() => setDeleteSubsectionDialogOpen(true)}>Delete subsection</IconButton>
          </div>
          <Field label="Subsection title">
            <input
              onChange={(event) => updateSelectedPageDraft({ title: event.target.value })}
              value={selectedPage.title || ""}
            />
          </Field>
          <Field label="Pages in this subsection">
            <input
              inputMode="numeric"
              min="1"
              max={MAX_SUBSECTION_PAGES}
              onChange={(event) => updateSubsectionPageCount(event.target.value)}
              type="number"
              value={selectedPage.subsectionPageCount || 1}
            />
          </Field>
          {selectedSubsectionPages.length > 1 && (
            <div className={styles.sectionActions}>
              {selectedSubsectionPages.map((page) => (
                <button
                  className={`${styles.pageTab} ${page.pageNumber === selectedPage.pageNumber ? styles.activePageTab : ""}`}
                  key={page.pageNumber}
                  onClick={() => setSelectedPageIndex(getPageIndexForSubsection(book, page.subsectionId, page.subsectionPageNumber))}
                  title="Preview this page"
                  type="button"
                >
                  <span>Page {page.pageNumber}</span>
                </button>
              ))}
            </div>
          )}
          {nestedStagesActive ? (
            <div className={styles.fieldGroup}>
              <span>Primary ornaments</span>
              <p className={styles.layoutSummary}>Each exercise&apos;s ornaments and density follow the nested tuplet steps below.</p>
            </div>
          ) : (
            <OrnamentTopicsEditor
              exerciseCount={linesPerPage * selectedSubsectionPages.length}
              onChange={updateSelectedPageGenerationDraft}
              ornaments={selectedPageGenerationSettings.ornaments}
              randomOrnaments={selectedPageGenerationSettings.randomOrnaments}
              segments={selectedPageGenerationSettings.ornamentSegments}
            />
          )}
          <NestedTupletPlanEditor
            exerciseCount={linesPerPage * selectedSubsectionPages.length}
            onChange={updateSelectedPageGenerationDraft}
            plan={selectedPageGenerationSettings.nestedTupletPlan}
            primaryRhythms={selectedSection.primaryRhythms}
            rhythmSpan={selectedSection.rhythmSpan}
            stages={selectedPageGenerationSettings.nestedTupletStages}
          />
          <SecondaryRowsEditor
            measuresPerLine={selectedPagePdfSettings.measuresPerLine}
            onChange={(secondaryRhythmRows) => updateSelectedPageGenerationDraft({ secondaryRhythmRows })}
            phases={selectedPageGenerationSettings.secondaryRhythmPhases}
            exerciseJoins={selectedPageGenerationSettings.secondaryRhythmExercises}
            pool={selectedSection.secondaryRhythms}
            rowCount={systemsPerPage * selectedSubsectionPages.length}
            rows={selectedPageGenerationSettings.secondaryRhythmRows}
          />
          <PagePlanSummary
            exerciseCount={linesPerPage * selectedSubsectionPages.length}
            rows={selectedPageGenerationSettings.secondaryRhythmRows}
            measuresPerLine={selectedPagePdfSettings.measuresPerLine}
            ornaments={selectedPageGenerationSettings.ornaments}
            nestedStages={nestedStagesActive ? selectedPageGenerationSettings.nestedTupletStages : null}
            playEveryNote={selectedPageGenerationSettings.playEveryNote}
            pool={selectedSection.secondaryRhythms}
            randomOrnaments={selectedPageGenerationSettings.randomOrnaments}
            segments={selectedPageGenerationSettings.ornamentSegments}
          />
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
            Each page generates {linesPerPage} rhythms automatically: {systemsPerPage} staff lines × {selectedPagePdfSettings.measuresPerLine} measures.
            {selectedSubsectionPages.length > 1 && ` ${linesPerPage * selectedSubsectionPages.length} rhythms across ${selectedSubsectionPages.length} pages.`}
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
            <span>No rests — play every note{nestedStagesActive ? " (nested tuplet steps set this per exercise)" : ""}</span>
          </label>
          <label className={styles.toggleField}>
            <input
              checked={Boolean(selectedPageGenerationSettings.chainPrimaryGroups)}
              onChange={(event) =>
                updateSelectedPageGenerationDraft({ chainPrimaryGroups: event.target.checked })
              }
              type="checkbox"
            />
            <span>Primary groups may repeat back to back</span>
          </label>
          <Field label="Primary rhythms in each exercise">
            <select
              onChange={(event) => updateSelectedPageGenerationDraft({
                requirePrimaryRhythms: event.target.value === "each" ? undefined : event.target.value === "any" ? "any" : false,
              })}
              value={selectedPageGenerationSettings.requirePrimaryRhythms === false ? "none"
                : selectedPageGenerationSettings.requirePrimaryRhythms === "any" ? "any" : "each"}
            >
              <option value="each">Each primary rhythm at least once</option>
              <option value="any">At least one of the primary rhythms</option>
              <option value="none">None required (draw from the pool at random)</option>
            </select>
          </Field>
          <label className={styles.toggleField}>
            <input
              checked={Boolean(selectedPageGenerationSettings.requireNewestSecondary)}
              onChange={(event) =>
                updateSelectedPageGenerationDraft({ requireNewestSecondary: event.target.checked || undefined })
              }
              type="checkbox"
            />
            <span>Each exercise includes the newest secondary rhythm (with Secondary rhythms by row)</span>
          </label>
          {!selectedPageGenerationSettings.playEveryNote && selectedPageGenerationSettings.playedShareRamp && (
            <div className={styles.fieldGroup}>
              <span>Notes played, first exercise → last exercise of the subsection (%)</span>
              <div className={styles.topicActions}>
                {[["start", 0], ["start", 1], ["end", 0], ["end", 1]].map(([point, bound]) => (
                  <input
                    aria-label={`${point === "start" ? "First" : "Last"} exercise ${bound ? "most" : "fewest"} notes played (%)`}
                    key={`${point}-${bound}`}
                    max="100"
                    min="1"
                    onChange={(event) => {
                      const ramp = selectedPageGenerationSettings.playedShareRamp;
                      const range = [...ramp[point]];
                      range[bound] = Math.max(0.01, Math.min(1, Number(event.target.value) / 100 || 0.01));
                      updateSelectedPageGenerationDraft({ playedShareRamp: { ...ramp, [point]: range } });
                    }}
                    style={{ width: 72 }}
                    type="number"
                    value={Math.round(selectedPageGenerationSettings.playedShareRamp[point][bound] * 100)}
                  />
                ))}
              </div>
              <p className={styles.layoutSummary}>
                Starts at {Math.round(selectedPageGenerationSettings.playedShareRamp.start[0] * 100)}–{Math.round(selectedPageGenerationSettings.playedShareRamp.start[1] * 100)}% of notes played and thins evenly to {Math.round(selectedPageGenerationSettings.playedShareRamp.end[0] * 100)}–{Math.round(selectedPageGenerationSettings.playedShareRamp.end[1] * 100)}% by the subsection&apos;s last exercise.
              </p>
            </div>
          )}
          {!selectedPageGenerationSettings.playEveryNote && (
            <Field label="Most notes played (%)">
              <input
                inputMode="numeric"
                max="100"
                min="1"
                onChange={(event) => updateSelectedPageGenerationDraft({
                  maxPlayedShare: event.target.value === "" ? null : Number(event.target.value) / 100,
                })}
                placeholder="Any"
                type="number"
                value={selectedPageGenerationSettings.maxPlayedShare == null
                  ? ""
                  : Math.round(selectedPageGenerationSettings.maxPlayedShare * 100)}
              />
            </Field>
          )}
          {!selectedPageGenerationSettings.playEveryNote && (
            <Field label="Fully played primary groups (%)">
              <input
                inputMode="numeric"
                max="100"
                min="0"
                onChange={(event) => updateSelectedPageGenerationDraft({
                  fullPrimaryGroupShare: event.target.value === "" ? null : Number(event.target.value) / 100,
                })}
                placeholder="Random"
                type="number"
                value={selectedPageGenerationSettings.fullPrimaryGroupShare == null
                  ? ""
                  : Math.round(selectedPageGenerationSettings.fullPrimaryGroupShare * 100)}
              />
            </Field>
          )}
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
          <label className={styles.toggleField}>
            <input type="checkbox" checked={Boolean(selectedPageGenerationSettings.stickingTail)}
              onChange={(event) => updateSelectedPageGenerationDraft({ stickingTail: event.target.checked
                ? { count: 5, maxSameHandStickingRun: 4, requiredSameHandStickingRuns: [3, 4] } : null })} />
            <span>Use separate sticking rules for the final printed rows</span>
          </label>
          {selectedPageGenerationSettings.stickingTail && <>
            <Field label="Final staff rows"><input type="number" min="1" max={systemsPerPage}
              value={selectedPageGenerationSettings.stickingTail.count}
              onChange={(event) => updateSelectedPageGenerationDraft({ stickingTail: normalizeStickingTail({ ...selectedPageGenerationSettings.stickingTail, count: event.target.value }) })} /></Field>
            <Field label="Final rows: maximum same-hand run"><input type="number" min="1" max="32"
              value={selectedPageGenerationSettings.stickingTail.maxSameHandStickingRun}
              onChange={(event) => updateSelectedPageGenerationDraft({ stickingTail: normalizeStickingTail({ ...selectedPageGenerationSettings.stickingTail, maxSameHandStickingRun: event.target.value }) })} /></Field>
            <CheckboxPicker label="Final rows: required same-hand run lengths (OR)"
              options={Array.from({ length: selectedPageGenerationSettings.stickingTail.maxSameHandStickingRun }, (_, i) => ({ id: i + 1, label: String(i + 1) }))}
              value={selectedPageGenerationSettings.stickingTail.requiredSameHandStickingRuns}
              onToggle={(id) => updateSelectedPageGenerationDraft({ stickingTail: normalizeStickingTail({ ...selectedPageGenerationSettings.stickingTail,
                requiredSameHandStickingRuns: toggleOption(selectedPageGenerationSettings.stickingTail.requiredSameHandStickingRuns, id),
              }) })} />
            <p className={styles.layoutSummary}>Applies to the last {Math.min(systemsPerPage, selectedPageGenerationSettings.stickingTail.count)} printed rows ({Math.min(linesPerPage, selectedPageGenerationSettings.stickingTail.count * selectedPagePdfSettings.measuresPerLine)} exercises){selectedSubsectionPages.length > 1 && " of the subsection's last page"}, when stickings are selected.</p>
          </>}
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
        isOpen={deleteGroupDialogOpen}
        message={`Delete span group "${selectedGroup.title}" and all its sections and pages?`}
        onCancel={() => setDeleteGroupDialogOpen(false)}
        onOk={deleteGroup}
      />
      <Dialog
        isOpen={deleteSubsectionDialogOpen}
        message={`Delete subsection "${selectedPage.title}" and its exercises?`}
        onCancel={() => setDeleteSubsectionDialogOpen(false)}
        onOk={() => changeSubsectionOrder(0, true)}
      />
      <Dialog
        isOpen={deleteSectionDialogOpen}
        message={`Delete "${selectedSection.title}" and all of its pages?`}
        onCancel={() => setDeleteSectionDialogOpen(false)}
        onOk={deleteSelectedSection}
      />
    </aside>
  );
}
