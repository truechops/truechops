import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ActionCreators } from "redux-undo";
import _ from "lodash";
import {
  FaArrowDown,
  FaArrowUp,
  FaBookOpen,
  FaChevronLeft,
  FaChevronRight,
  FaCog,
  FaCopy,
  FaDownload,
  FaFileAlt,
  FaMusic,
  FaPlay,
  FaPlus,
  FaRedo,
  FaSave,
  FaStop,
  FaTrash,
  FaUndo,
  FaUpload,
} from "react-icons/fa";

import Buttons from "../compose/Buttons";
import Score from "../compose/Score";
import ErrorBoundary from "../error/ErrorBoundary";
import addComposeEventListeners from "../compose/event-listeners";
import { paradiddle as sampleSnareScore } from "../compose/sample-score";
import { getEmptyMeasure } from "../../helpers/score";
import { DEFAULT_TEMPO } from "../../consts/score";
import { getToneJs, scoreActions } from "../../store/score";
import ToneContext from "../../store/tone-context";
import { setSamplers, update as updateToneJs } from "../../lib/tone";
import styles from "./BookBuilder.module.css";

const STORAGE_KEY = "truechops.snare-book-builder.v1";
const SCORE_ROOT_ID = "book-builder-score-root";
const SCORE_SVG_ID = "book-builder-vexflow";

const TRIM_SIZES = {
  letter: { label: "Letter", width: 8.5, height: 11 },
  digest: { label: "Digest", width: 5.5, height: 8.5 },
  sixNine: { label: "6 x 9", width: 6, height: 9 },
  a4: { label: "A4", width: 8.27, height: 11.69 },
};

const DEFAULT_BOOK_SETTINGS = {
  title: "Snare Drum Book",
  subtitle: "Warmups, grids, and chops",
  trimSize: "letter",
  orientation: "portrait",
  margin: 0.65,
  notationScale: 0.72,
  showPageNumbers: true,
  justifySystems: true,
};

const DEFAULT_PAGE = {
  section: "Foundations",
  subtitle: "",
  focus: "Control",
  tempo: DEFAULT_TEMPO,
  notes: "",
};

function createId() {
  return `book-page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptySnareScore(measureCount = 4) {
  const timeSig = { num: 4, type: 4 };

  return {
    parts: {
      snare: {
        enabled: true,
      },
    },
    measures: Array.from({ length: measureCount }, () =>
      _.cloneDeep(getEmptyMeasure(timeSig, ["snare"]))
    ),
  };
}

function createPage(index, overrides = {}) {
  return {
    id: createId(),
    title: `Exercise ${index + 1}`,
    ...DEFAULT_PAGE,
    score: createEmptySnareScore(4),
    ...overrides,
  };
}

function createDefaultBook() {
  return {
    bookSettings: { ...DEFAULT_BOOK_SETTINGS },
    pages: [
      createPage(0, {
        title: "Paradiddle Check",
        subtitle: "Right and left lead control",
        focus: "Stickings",
        score: _.cloneDeep(sampleSnareScore),
      }),
      createPage(1, {
        title: "Accent Grid",
        subtitle: "Two-height motion",
        focus: "Accents",
        score: createEmptySnareScore(6),
      }),
      createPage(2, {
        title: "Roll Builder",
        subtitle: "Diddles and release notes",
        focus: "Rolls",
        score: createEmptySnareScore(8),
      }),
    ],
  };
}

function normalizeBook(rawBook) {
  const fallback = createDefaultBook();

  if (!rawBook || !Array.isArray(rawBook.pages) || rawBook.pages.length === 0) {
    return fallback;
  }

  return {
    bookSettings: {
      ...DEFAULT_BOOK_SETTINGS,
      ...(rawBook.bookSettings || {}),
    },
    pages: rawBook.pages.map((page, index) => ({
      ...createPage(index),
      ...page,
      id: page.id || createId(),
      score: page.score || createEmptySnareScore(4),
      tempo: Number(page.tempo || DEFAULT_TEMPO),
    })),
  };
}

function readInitialBook() {
  if (typeof window === "undefined") {
    return createDefaultBook();
  }

  try {
    const savedBook = window.localStorage.getItem(STORAGE_KEY);
    if (!savedBook) {
      return createDefaultBook();
    }

    return normalizeBook(JSON.parse(savedBook));
  } catch (error) {
    return createDefaultBook();
  }
}

function getTrimDimensions(settings) {
  const trim = TRIM_SIZES[settings.trimSize] || TRIM_SIZES.letter;

  if (settings.orientation === "landscape") {
    return {
      width: trim.height,
      height: trim.width,
    };
  }

  return {
    width: trim.width,
    height: trim.height,
  };
}

function getMeasureCount(page) {
  return page.score && Array.isArray(page.score.measures)
    ? page.score.measures.length
    : 0;
}

function toSafeFileName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "snare-book";
}

function IconTextButton({ children, icon, isActive, onClick, title, type = "button" }) {
  return (
    <button
      className={`${styles.iconTextButton} ${isActive ? styles.activeButton : ""}`}
      onClick={onClick}
      title={title}
      type={type}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function IconButton({ children, disabled, icon, onClick, title }) {
  return (
    <button
      aria-label={title}
      className={styles.iconButton}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
      {children && <span>{children}</span>}
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

function ToggleField({ checked, label, onChange }) {
  return (
    <label className={styles.toggleField}>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

export default function BookBuilder() {
  const initialBookRef = useRef(readInitialBook());
  const [bookSettings, setBookSettings] = useState(initialBookRef.current.bookSettings);
  const [pages, setPages] = useState(initialBookRef.current.pages);
  const [activePageId, setActivePageId] = useState(initialBookRef.current.pages[0].id);
  const [inspectorTab, setInspectorTab] = useState("rhythm");
  const [composeTab, setComposeTab] = useState(1);
  const [previewWidth, setPreviewWidth] = useState(640);
  const [notice, setNotice] = useState("Autosaved");

  const dispatch = useDispatch();
  const score = useSelector((state) => state.score.present.score);
  const currentTempo = useSelector((state) => state.score.present.tempo);
  const repeat = useSelector((state) => state.score.present.repeat);
  const isPlaying = useSelector((state) => state.score.present.isPlaying);
  const toneJs = useSelector((state) => getToneJs(state.score.present));
  const scoreViewportRef = useRef(null);
  const fileInputRef = useRef(null);
  const scoreRef = useRef(score);
  const tempoRef = useRef(currentTempo);
  const loadedInitialPageRef = useRef(false);
  const suppressNextScoreSyncRef = useRef(false);
  const suppressNextTempoSyncRef = useRef(false);

  const {
    setSampler,
    snareSampler,
    tenorsSampler,
    bassSampler,
    cymbalsSampler,
  } = useContext(ToneContext);

  const activePageIndex = pages.findIndex((page) => page.id === activePageId);
  const activePage = pages[activePageIndex] || pages[0];
  const trim = getTrimDimensions(bookSettings);
  const notationScale = Number(bookSettings.notationScale) || DEFAULT_BOOK_SETTINGS.notationScale;

  const paperStyle = {
    "--paper-ratio": `${trim.width} / ${trim.height}`,
    "--margin-x": `${Math.max(2, (Number(bookSettings.margin) / trim.width) * 100)}%`,
    "--margin-y": `${Math.max(2, (Number(bookSettings.margin) / trim.height) * 100)}%`,
  };

  const scoreSvgConfig = useMemo(
    () => ({
      width: Math.max(360, previewWidth / notationScale),
      scale: notationScale,
      hResize: notationScale,
      vResize: notationScale,
      justifyLastRow: bookSettings.justifySystems,
    }),
    [bookSettings.justifySystems, notationScale, previewWidth]
  );

  const startStop = useCallback(() => {
    dispatch(scoreActions.startStop());
  }, [dispatch]);

  const loadPageIntoComposer = useCallback(
    (page) => {
      if (!page) {
        return;
      }

      suppressNextScoreSyncRef.current = true;
      suppressNextTempoSyncRef.current = true;
      dispatch(
        scoreActions.updateScore({
          score: _.cloneDeep(page.score),
          name: page.title,
          tempo: page.tempo || DEFAULT_TEMPO,
          mutations: [],
        })
      );
    },
    [dispatch]
  );

  const getPagesWithActiveSnapshot = useCallback(
    (sourcePages) =>
      sourcePages.map((page) =>
        page.id === activePageId
          ? {
              ...page,
              score: _.cloneDeep(scoreRef.current),
              tempo: tempoRef.current || page.tempo,
            }
          : page
      ),
    [activePageId]
  );

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    tempoRef.current = currentTempo;
  }, [currentTempo]);

  useEffect(() => {
    if (!window.tcEventsAdded) {
      addComposeEventListeners(dispatch);
    }

    window.tcEventsAdded = true;
  }, [dispatch]);

  useEffect(() => {
    if (!loadedInitialPageRef.current) {
      loadedInitialPageRef.current = true;
      loadPageIntoComposer(activePage);
    }
  }, [activePage, loadPageIntoComposer]);

  useEffect(() => {
    if (!setSampler || !snareSampler || !tenorsSampler || !bassSampler || !cymbalsSampler) {
      return;
    }

    setSamplers(setSampler, snareSampler, tenorsSampler, bassSampler, cymbalsSampler);
  }, [bassSampler, cymbalsSampler, setSampler, snareSampler, tenorsSampler]);

  useEffect(() => {
    if (!setSampler || !snareSampler || !tenorsSampler || !bassSampler || !cymbalsSampler) {
      return;
    }

    updateToneJs(toneJs, repeat, startStop);
  }, [bassSampler, cymbalsSampler, repeat, setSampler, snareSampler, startStop, tenorsSampler, toneJs]);

  useEffect(() => {
    if (suppressNextScoreSyncRef.current) {
      suppressNextScoreSyncRef.current = false;
      return;
    }

    setPages((currentPages) => {
      const page = currentPages.find((candidate) => candidate.id === activePageId);

      if (!page || _.isEqual(page.score, score)) {
        return currentPages;
      }

      return currentPages.map((candidate) =>
        candidate.id === activePageId
          ? { ...candidate, score: _.cloneDeep(score) }
          : candidate
      );
    });
  }, [activePageId, score]);

  useEffect(() => {
    if (suppressNextTempoSyncRef.current) {
      suppressNextTempoSyncRef.current = false;
      return;
    }

    setPages((currentPages) =>
      currentPages.map((page) =>
        page.id === activePageId && page.tempo !== currentTempo
          ? { ...page, tempo: currentTempo }
          : page
      )
    );
  }, [activePageId, currentTempo]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        bookSettings,
        pages,
      })
    );
    setNotice("Autosaved");
  }, [bookSettings, pages]);

  useEffect(() => {
    const node = scoreViewportRef.current;
    if (!node) {
      return undefined;
    }

    const updatePreviewWidth = () => {
      setPreviewWidth(Math.max(320, node.clientWidth));
    };

    updatePreviewWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePreviewWidth);
      return () => window.removeEventListener("resize", updatePreviewWidth);
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0] ? entries[0].contentRect.width : node.clientWidth;
      setPreviewWidth(Math.max(320, width));
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [activePageId, bookSettings.margin, bookSettings.orientation, bookSettings.trimSize]);

  const updateBookSetting = useCallback((key, value) => {
    setBookSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
  }, []);

  const updateActivePage = useCallback(
    (updates) => {
      setPages((currentPages) =>
        currentPages.map((page) =>
          page.id === activePageId ? { ...page, ...updates } : page
        )
      );
    },
    [activePageId]
  );

  const updateTempo = useCallback(
    (value) => {
      const tempo = Number(value);
      dispatch(scoreActions.updateTempo(tempo));
      updateActivePage({ tempo });
    },
    [dispatch, updateActivePage]
  );

  const selectPage = useCallback(
    (pageId) => {
      if (pageId === activePageId) {
        return;
      }

      const nextPages = getPagesWithActiveSnapshot(pages);
      const nextPage = nextPages.find((page) => page.id === pageId);

      setPages(nextPages);
      setActivePageId(pageId);
      loadPageIntoComposer(nextPage);
    },
    [activePageId, getPagesWithActiveSnapshot, loadPageIntoComposer, pages]
  );

  const insertPageAfter = useCallback(() => {
    const nextPages = getPagesWithActiveSnapshot(pages);
    const insertIndex = Math.max(0, nextPages.findIndex((page) => page.id === activePageId));
    const newPage = createPage(nextPages.length);

    nextPages.splice(insertIndex + 1, 0, newPage);
    setPages(nextPages);
    setActivePageId(newPage.id);
    loadPageIntoComposer(newPage);
  }, [activePageId, getPagesWithActiveSnapshot, loadPageIntoComposer, pages]);

  const duplicateActivePage = useCallback(() => {
    const nextPages = getPagesWithActiveSnapshot(pages);
    const sourceIndex = Math.max(0, nextPages.findIndex((page) => page.id === activePageId));
    const sourcePage = nextPages[sourceIndex];
    const newPage = {
      ...sourcePage,
      id: createId(),
      title: `${sourcePage.title} Copy`,
      score: _.cloneDeep(sourcePage.score),
    };

    nextPages.splice(sourceIndex + 1, 0, newPage);
    setPages(nextPages);
    setActivePageId(newPage.id);
    loadPageIntoComposer(newPage);
  }, [activePageId, getPagesWithActiveSnapshot, loadPageIntoComposer, pages]);

  const deleteActivePage = useCallback(() => {
    const snapshotPages = getPagesWithActiveSnapshot(pages);

    if (snapshotPages.length === 1) {
      const newPage = createPage(0);
      setPages([newPage]);
      setActivePageId(newPage.id);
      loadPageIntoComposer(newPage);
      return;
    }

    const removeIndex = Math.max(0, snapshotPages.findIndex((page) => page.id === activePageId));
    const nextPages = snapshotPages.filter((page) => page.id !== activePageId);
    const nextPage = nextPages[Math.max(0, removeIndex - 1)];

    setPages(nextPages);
    setActivePageId(nextPage.id);
    loadPageIntoComposer(nextPage);
  }, [activePageId, getPagesWithActiveSnapshot, loadPageIntoComposer, pages]);

  const moveActivePage = useCallback(
    (direction) => {
      const nextPages = getPagesWithActiveSnapshot(pages);
      const fromIndex = nextPages.findIndex((page) => page.id === activePageId);
      const toIndex = fromIndex + direction;

      if (fromIndex < 0 || toIndex < 0 || toIndex >= nextPages.length) {
        return;
      }

      const [page] = nextPages.splice(fromIndex, 1);
      nextPages.splice(toIndex, 0, page);
      setPages(nextPages);
    },
    [activePageId, getPagesWithActiveSnapshot, pages]
  );

  const goToAdjacentPage = useCallback(
    (direction) => {
      const nextIndex = activePageIndex + direction;
      if (nextIndex < 0 || nextIndex >= pages.length) {
        return;
      }

      selectPage(pages[nextIndex].id);
    },
    [activePageIndex, pages, selectPage]
  );

  const exportBook = useCallback(() => {
    const snapshotPages = getPagesWithActiveSnapshot(pages);
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      bookSettings,
      pages: snapshotPages,
    };

    setPages(snapshotPages);

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${toSafeFileName(bookSettings.title)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Exported");
  }, [bookSettings, getPagesWithActiveSnapshot, pages]);

  const importBook = useCallback(
    (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const nextBook = normalizeBook(JSON.parse(reader.result));
          setBookSettings(nextBook.bookSettings);
          setPages(nextBook.pages);
          setActivePageId(nextBook.pages[0].id);
          loadPageIntoComposer(nextBook.pages[0]);
          setNotice("Imported");
        } catch (error) {
          setNotice("Import failed");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [loadPageIntoComposer]
  );

  const composeTabSelected = useCallback((event, newValue) => {
    setComposeTab(newValue);
  }, []);

  if (!activePage) {
    return null;
  }

  return (
    <main className={styles.builder}>
      <aside className={styles.pageRail}>
        <div className={styles.railHeader}>
          <div>
            <span className={styles.eyebrow}>Book</span>
            <h1>{bookSettings.title}</h1>
          </div>
          <IconButton icon={<FaPlus />} onClick={insertPageAfter} title="Insert page" />
        </div>

        <div className={styles.pageList}>
          {pages.map((page, index) => (
            <button
              className={`${styles.pageItem} ${page.id === activePageId ? styles.activePage : ""}`}
              key={page.id}
              onClick={() => selectPage(page.id)}
              type="button"
            >
              <span className={styles.pageNumber}>{index + 1}</span>
              <span className={styles.pageSummary}>
                <strong>{page.title}</strong>
                <span>{page.section} / {getMeasureCount(page)} measures</span>
              </span>
            </button>
          ))}
        </div>

        <div className={styles.railActions}>
          <IconButton
            disabled={activePageIndex <= 0}
            icon={<FaArrowUp />}
            onClick={() => moveActivePage(-1)}
            title="Move page up"
          />
          <IconButton
            disabled={activePageIndex >= pages.length - 1}
            icon={<FaArrowDown />}
            onClick={() => moveActivePage(1)}
            title="Move page down"
          />
          <IconButton icon={<FaCopy />} onClick={duplicateActivePage} title="Duplicate page" />
          <IconButton icon={<FaTrash />} onClick={deleteActivePage} title="Delete page" />
        </div>
      </aside>

      <section className={styles.previewColumn}>
        <div className={styles.previewToolbar}>
          <div className={styles.previewTitle}>
            <span className={styles.eyebrow}>{activePage.section}</span>
            <h2>{activePage.title}</h2>
          </div>

          <div className={styles.toolbarCluster}>
            <IconButton
              disabled={activePageIndex <= 0}
              icon={<FaChevronLeft />}
              onClick={() => goToAdjacentPage(-1)}
              title="Previous page"
            />
            <span className={styles.pageCounter}>{activePageIndex + 1} / {pages.length}</span>
            <IconButton
              disabled={activePageIndex >= pages.length - 1}
              icon={<FaChevronRight />}
              onClick={() => goToAdjacentPage(1)}
              title="Next page"
            />
            <span className={styles.toolbarDivider} />
            <IconButton icon={<FaUndo />} onClick={() => dispatch(ActionCreators.undo())} title="Undo" />
            <IconButton icon={<FaRedo />} onClick={() => dispatch(ActionCreators.redo())} title="Redo" />
            <IconButton
              icon={isPlaying ? <FaStop /> : <FaPlay />}
              onClick={startStop}
              title={isPlaying ? "Stop" : "Play"}
            />
          </div>
        </div>

        <div className={styles.paperStage}>
          <article className={styles.paper} style={paperStyle}>
            <header className={styles.paperHeader}>
              <div>
                <span>{activePage.section}</span>
                <h3>{activePage.title}</h3>
                {activePage.subtitle && <p>{activePage.subtitle}</p>}
              </div>
              <div className={styles.paperMeta}>
                <span>{activePage.focus}</span>
                <strong>{activePage.tempo} BPM</strong>
              </div>
            </header>

            <div className={styles.scoreViewport} id={SCORE_ROOT_ID} ref={scoreViewportRef}>
              <ErrorBoundary component="book builder score">
                <Score
                  id={SCORE_SVG_ID}
                  score={score}
                  scoreRootId={SCORE_ROOT_ID}
                  selectedTab={composeTab}
                  showTitle={false}
                  svgConfig={scoreSvgConfig}
                  tabPanelHidden={false}
                  vexflowClass={styles.vexflow}
                  vexflowWrapperClass={styles.vexflowWrapper}
                />
              </ErrorBoundary>
            </div>

            <footer className={styles.paperFooter}>
              <span>{bookSettings.title}</span>
              {bookSettings.showPageNumbers && <strong>{activePageIndex + 1}</strong>}
            </footer>
          </article>
        </div>
      </section>

      <aside className={styles.inspector}>
        <div className={styles.inspectorTop}>
          <div>
            <span className={styles.eyebrow}>Builder</span>
            <h2>{notice}</h2>
          </div>
          <div className={styles.fileActions}>
            <IconButton icon={<FaDownload />} onClick={exportBook} title="Export JSON" />
            <IconButton icon={<FaUpload />} onClick={() => fileInputRef.current.click()} title="Import JSON" />
            <input
              accept="application/json"
              className={styles.fileInput}
              onChange={importBook}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </div>

        <div className={styles.segmented}>
          <IconTextButton
            icon={<FaMusic />}
            isActive={inspectorTab === "rhythm"}
            onClick={() => setInspectorTab("rhythm")}
            title="Rhythm"
          >
            Rhythm
          </IconTextButton>
          <IconTextButton
            icon={<FaFileAlt />}
            isActive={inspectorTab === "page"}
            onClick={() => setInspectorTab("page")}
            title="Page"
          >
            Page
          </IconTextButton>
          <IconTextButton
            icon={<FaCog />}
            isActive={inspectorTab === "render"}
            onClick={() => setInspectorTab("render")}
            title="Render"
          >
            Render
          </IconTextButton>
        </div>

        {inspectorTab === "rhythm" && (
          <section className={styles.inspectorPanel}>
            <div className={styles.panelTitle}>
              <FaMusic />
              <h3>Rhythm</h3>
            </div>
            <ErrorBoundary component="book builder buttons">
              <Buttons
                compact
                onTabSelected={composeTabSelected}
                scoreRootId={SCORE_ROOT_ID}
                selectedTab={composeTab}
              />
            </ErrorBoundary>
          </section>
        )}

        {inspectorTab === "page" && (
          <section className={styles.inspectorPanel}>
            <div className={styles.panelTitle}>
              <FaFileAlt />
              <h3>Page</h3>
            </div>
            <Field label="Title">
              <input
                onChange={(event) => updateActivePage({ title: event.target.value })}
                value={activePage.title}
              />
            </Field>
            <Field label="Subtitle">
              <input
                onChange={(event) => updateActivePage({ subtitle: event.target.value })}
                value={activePage.subtitle}
              />
            </Field>
            <Field label="Section">
              <input
                onChange={(event) => updateActivePage({ section: event.target.value })}
                value={activePage.section}
              />
            </Field>
            <Field label="Focus">
              <input
                onChange={(event) => updateActivePage({ focus: event.target.value })}
                value={activePage.focus}
              />
            </Field>
            <Field label="Tempo">
              <input
                max="250"
                min="40"
                onChange={(event) => updateTempo(event.target.value)}
                type="number"
                value={activePage.tempo}
              />
            </Field>
            <Field label="Notes">
              <textarea
                onChange={(event) => updateActivePage({ notes: event.target.value })}
                rows={5}
                value={activePage.notes}
              />
            </Field>
          </section>
        )}

        {inspectorTab === "render" && (
          <section className={styles.inspectorPanel}>
            <div className={styles.panelTitle}>
              <FaBookOpen />
              <h3>Render</h3>
            </div>
            <Field label="Book title">
              <input
                onChange={(event) => updateBookSetting("title", event.target.value)}
                value={bookSettings.title}
              />
            </Field>
            <Field label="Subtitle">
              <input
                onChange={(event) => updateBookSetting("subtitle", event.target.value)}
                value={bookSettings.subtitle}
              />
            </Field>
            <Field label="Trim">
              <select
                onChange={(event) => updateBookSetting("trimSize", event.target.value)}
                value={bookSettings.trimSize}
              >
                {Object.entries(TRIM_SIZES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Orientation">
              <select
                onChange={(event) => updateBookSetting("orientation", event.target.value)}
                value={bookSettings.orientation}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </Field>
            <Field label={`Margins ${bookSettings.margin} in`}>
              <input
                max="1.4"
                min="0.25"
                onChange={(event) => updateBookSetting("margin", Number(event.target.value))}
                step="0.05"
                type="range"
                value={bookSettings.margin}
              />
            </Field>
            <Field label={`Notation ${Math.round(notationScale * 100)}%`}>
              <input
                max="0.95"
                min="0.5"
                onChange={(event) => updateBookSetting("notationScale", Number(event.target.value))}
                step="0.01"
                type="range"
                value={bookSettings.notationScale}
              />
            </Field>
            <ToggleField
              checked={bookSettings.justifySystems}
              label="Justified systems"
              onChange={(value) => updateBookSetting("justifySystems", value)}
            />
            <ToggleField
              checked={bookSettings.showPageNumbers}
              label="Page numbers"
              onChange={(value) => updateBookSetting("showPageNumbers", value)}
            />
          </section>
        )}

        <div className={styles.saveStrip}>
          <FaSave />
          <span>{pages.length} pages</span>
        </div>
      </aside>
    </main>
  );
}
