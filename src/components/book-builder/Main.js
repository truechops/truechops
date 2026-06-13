import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  FaArrowDown,
  FaArrowUp,
  FaBook,
  FaEraser,
  FaFolderOpen,
  FaFilePdf,
  FaPlus,
  FaSave,
  FaUpload,
} from "react-icons/fa";

import Dialog from "../ui/Dialog";
import { scoreActions } from "../../store/score";
import { drawScore, initialize } from "../../lib/vexflow";
import {
  LINES_PER_PAGE,
  createBlankLine,
  createBlankLineScore,
  createBlankPage,
  createDefaultBook,
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

function updateBookLine(book, pageIndex, lineIndex, updater) {
  return {
    ...book,
    pages: book.pages.map((page, currentPageIndex) => {
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
    }),
  };
}

export default function BookBuilderPanel() {
  const dispatch = useDispatch();
  const score = useSelector((state) => state.score.present.score);
  const tempo = useSelector((state) => state.score.present.tempo);
  const [book, setBook] = useState(createDefaultBook());
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [status, setStatus] = useState("Loading");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const selectedPage = book.pages[selectedPageIndex] || book.pages[0];
  const selectedLine = selectedPage.lines[selectedLineIndex] || selectedPage.lines[0];

  const filledLineCount = useMemo(
    () => book.pages.flatMap((page) => page.lines).filter((line) => line.score).length,
    [book.pages]
  );

  const loadBook = useCallback(async () => {
    try {
      const response = await fetch("/api/book-builder");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load book");
      }

      setBook(normalizeBook(payload.book));
      setStatus("Loaded from disk");
    } catch (error) {
      setBook(createDefaultBook());
      setStatus("Using blank book");
    }
  }, []);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

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

      setBook(normalizeBook(payload.book));
      setStatus(successMessage);
    } catch (error) {
      setStatus("Save failed");
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
    const flatLines = book.pages.flatMap((page) => page.lines);
    const absoluteIndex = selectedPageIndex * LINES_PER_PAGE + selectedLineIndex;
    flatLines.splice(absoluteIndex + 1, 0, createBlankLine(1, 1));

    const nextPageIndex = Math.floor((absoluteIndex + 1) / LINES_PER_PAGE);
    const nextLineIndex = (absoluteIndex + 1) % LINES_PER_PAGE;
    const nextBook = {
      ...book,
      pages: renumberPages([{ lines: flatLines }]),
    };

    setSelectedPageIndex(nextPageIndex);
    setSelectedLineIndex(nextLineIndex);
    saveBook(nextBook, "Inserted blank line");
  }, [book, saveBook, selectedLineIndex, selectedPageIndex]);

  const moveSelectedLine = useCallback(
    (direction) => {
      const flatLines = book.pages.flatMap((page) => page.lines);
      const fromIndex = selectedPageIndex * LINES_PER_PAGE + selectedLineIndex;
      const toIndex = fromIndex + direction;

      if (toIndex < 0 || toIndex >= flatLines.length) {
        return;
      }

      const [line] = flatLines.splice(fromIndex, 1);
      flatLines.splice(toIndex, 0, line);

      const nextPageIndex = Math.floor(toIndex / LINES_PER_PAGE);
      const nextLineIndex = toIndex % LINES_PER_PAGE;
      const nextBook = {
        ...book,
        pages: renumberPages([{ lines: flatLines }]),
      };

      setSelectedPageIndex(nextPageIndex);
      setSelectedLineIndex(nextLineIndex);
      saveBook(nextBook, "Moved line");
    },
    [book, saveBook, selectedLineIndex, selectedPageIndex]
  );

  const addPage = useCallback(() => {
    const nextBook = {
      ...book,
      pages: [...book.pages, createBlankPage(book.pages.length + 1)],
    };

    setSelectedPageIndex(nextBook.pages.length - 1);
    setSelectedLineIndex(0);
    saveBook(nextBook, "Added page");
  }, [book, saveBook]);

  const downloadSelectedPagePdf = useCallback(() => {
    window.location.href = `/api/book-builder?format=pdf&page=${selectedPage.pageNumber}`;
  }, [selectedPage.pageNumber]);

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Book</span>
          <h2>{book.title}</h2>
          <p>{filledLineCount} saved rhythms / {book.pages.length * LINES_PER_PAGE} slots</p>
        </div>
        <IconButton icon={<FaSave />} onClick={saveMetadata} title="Save book" variant="iconOnly">
          Save
        </IconButton>
      </header>

      <div className={styles.status}>{isSaving ? "Saving..." : status}</div>

      <div className={styles.actions}>
        <IconButton icon={<FaUpload />} onClick={saveCurrentScoreToLine} title="Save current score to selected line" variant="primary">
          Score to line
        </IconButton>
        <IconButton icon={<FaFolderOpen />} onClick={loadSelectedLineToScore} title="Load selected line into score">
          Load line
        </IconButton>
        <IconButton icon={<FaFilePdf />} onClick={downloadSelectedPagePdf} title="Download selected page PDF">
          Page PDeF
        </IconButton>
        <IconButton icon={<FaSave />} onClick={saveMetadata} title="Save line details">
          Save details
        </IconButton>
      </div>

      <div className={styles.pageTabs}>
        {book.pages.map((page, pageIndex) => (
          <button
            className={`${styles.pageTab} ${pageIndex === selectedPageIndex ? styles.activePageTab : ""}`}
            key={page.pageNumber}
            onClick={() => {
              setSelectedPageIndex(pageIndex);
              setSelectedLineIndex(0);
            }}
            type="button"
          >
            {page.pageNumber}
          </button>
        ))}
        <button className={styles.pageTab} onClick={addPage} type="button">
          <FaPlus />
        </button>
      </div>

      <div className={styles.lineGrid}>
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
          <h3>Page {selectedPage.pageNumber}, Line {selectedLine.lineNumber}</h3>
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
            disabled={selectedPageIndex === 0 && selectedLineIndex === 0}
            onClick={() => moveSelectedLine(-1)}
            type="button"
          >
            <FaArrowUp />
            <span>Move up</span>
          </button>
          <button
            disabled={
              selectedPageIndex === book.pages.length - 1 &&
              selectedLineIndex === LINES_PER_PAGE - 1
            }
            onClick={() => moveSelectedLine(1)}
            type="button"
          >
            <FaArrowDown />
            <span>Move down</span>
          </button>
        </div>
      </section>
      <Dialog
        isOpen={deleteDialogOpen}
        message={`Clear page ${selectedPage.pageNumber}, line ${selectedLine.lineNumber}? The slot will remain blank.`}
        onCancel={() => setDeleteDialogOpen(false)}
        onOk={deleteSelectedLine}
      />
    </aside>
  );
}
