import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { appActions } from "../../store/app";
import { scoreActions } from "../../store/score";
import { drawScore, initialize } from "../../lib/vexflow";
import { BOOK_TITLE, createContinuousPageScore } from "./book-data";

const styles = {
  page: {
    boxSizing: "border-box",
    padding: "36px 24px 56px",
    maxWidth: "960px",
    width: "100%",
    margin: "0 auto",
    fontFamily: "Georgia, serif",
  },
  header: {
    marginBottom: "22px",
    borderBottom: "4px solid #222",
    paddingBottom: "22px",
  },
  title: {
    fontSize: "34px",
    fontWeight: "bold",
    lineHeight: 1.15,
    margin: "0 0 10px",
  },
  subtitle: {
    fontSize: "22px",
    color: "#555",
    margin: 0,
  },
  prompt: {
    fontSize: "25px",
    color: "#333",
    marginBottom: "18px",
  },
  selectionActions: {
    alignItems: "center",
    borderBottom: "1px solid #ddd",
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "20px",
    paddingBottom: "18px",
  },
  selectionSummary: {
    color: "#444",
    flex: "1 1 220px",
    fontSize: "17px",
    margin: 0,
  },
  button: {
    border: "1px solid #111",
    borderRadius: "6px",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
    fontWeight: 700,
    padding: "10px 14px",
  },
  secondaryButton: {
    background: "#fff",
    color: "#111",
  },
  disabledButton: {
    cursor: "default",
    opacity: 0.45,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    margin: "0 auto",
    width: "100%",
  },
  exerciseWrap: {
    position: "relative",
    width: "100%",
  },
  exerciseRow: {
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
    minHeight: "134px",
    width: "100%",
    padding: "16px 16px 14px 46px",
    fontFamily: "Georgia, serif",
    border: "1px solid #d7d7d7",
    borderRadius: "14px",
    background: "#fff",
    cursor: "pointer",
    color: "#111",
    textAlign: "left",
  },
  exerciseRowSelected: {
    background: "#f1f7ff",
    border: "2px solid #1e5ea8",
    padding: "15px 15px 13px 45px",
  },
  exerciseNumber: {
    alignItems: "center",
    background: "#f2f2f2",
    border: "1px solid #ddd",
    borderRadius: "10px",
    display: "flex",
    fontSize: "26px",
    fontWeight: "bold",
    height: "52px",
    justifyContent: "center",
    left: "-20px",
    pointerEvents: "none",
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: "48px",
    zIndex: 1,
  },
  selectionOrder: {
    alignItems: "center",
    background: "#1e5ea8",
    borderRadius: "999px",
    color: "#fff",
    display: "flex",
    flex: "0 0 auto",
    fontFamily: "Arial, sans-serif",
    fontSize: "16px",
    fontWeight: 700,
    height: "34px",
    justifyContent: "center",
    width: "34px",
  },
  selectionOrderSlot: {
    alignItems: "center",
    display: "flex",
    flex: "0 0 46px",
    justifyContent: "flex-end",
    marginLeft: "12px",
    width: "46px",
  },
  exerciseButtonEmpty: {
    color: "#bbb",
    cursor: "default",
    background: "#fafafa",
  },
  preview: {
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
  },
  previewInner: {
    marginLeft: "-10px",
    overflow: "visible",
  },
  blankPreview: {
    color: "#aaa",
    fontSize: "14px",
    fontStyle: "italic",
  },
  message: {
    fontSize: "18px",
    color: "#555",
    padding: "28px 0",
    textAlign: "center",
  },
  error: {
    color: "#8a1f1f",
  },
};

const EDITOR_SCORE_SCALE = 0.75;
const VEXFLOW_RENDER_PADDING = 50;

function getPageLabel(pageRef) {
  return pageRef ? `Page ${pageRef.page}` : "Book page";
}

function RhythmPreview({ line }) {
  const reactId = useId();
  const previewRef = useRef(null);
  const [previewWidth, setPreviewWidth] = useState(720);
  const previewId = `book-practice-preview-${reactId.replace(/:/g, "")}-${line.pageNumber}-${line.lineNumber}`;

  useEffect(() => {
    const previewElement = previewRef.current;
    if (!previewElement) return;

    const updatePreviewWidth = () => {
      const nextWidth = Math.floor(previewElement.getBoundingClientRect().width);
      if (!nextWidth) return;
      setPreviewWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) > 2 ? nextWidth : currentWidth
      );
    };

    updatePreviewWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePreviewWidth);
      return () => window.removeEventListener("resize", updatePreviewWidth);
    }

    const resizeObserver = new ResizeObserver(updatePreviewWidth);
    resizeObserver.observe(previewElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!line.score) return;

    const container = document.getElementById(previewId);
    if (!container) return;

    container.innerHTML = "";
    const { renderer, context } = initialize(previewId);
    const scoreWidth = Math.max(
      300,
      Math.floor(previewWidth / EDITOR_SCORE_SCALE - VEXFLOW_RENDER_PADDING)
    );
    drawScore(
      renderer,
      context,
      line.score,
      null,
      () => {},
      {
        width: scoreWidth,
        scale: EDITOR_SCORE_SCALE,
        hResize: EDITOR_SCORE_SCALE,
        vResize: EDITOR_SCORE_SCALE,
        justifyLastRow: true,
      },
      {}
    );
  }, [line.score, previewId, previewWidth]);

  if (!line.score) {
    return <span style={styles.blankPreview}>Blank</span>;
  }

  return (
    <div ref={previewRef} style={styles.preview}>
      <div id={previewId} style={styles.previewInner} />
    </div>
  );
}

export default function PagePractice() {
  const [pagePayload, setPagePayload] = useState(null);
  const [selectedLineNumbers, setSelectedLineNumbers] = useState([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const router = useRouter();
  const selectedToken = typeof router.query.token === "string"
    ? router.query.token.trim()
    : "";

  useEffect(() => {
    dispatch(appActions.setPageLoaded());
  }, [dispatch]);

  useEffect(() => {
    if (!router.isReady) return;

    if (!selectedToken) {
      setPagePayload(null);
      setSelectedLineNumbers([]);
      setLoadingPage(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoadingPage(true);
    setError(null);

    fetch(`/api/book-pages/${encodeURIComponent(selectedToken)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Could not load that page.");
        }
        return result;
      })
      .then((result) => {
        if (!cancelled) {
          setPagePayload(result);
          setSelectedLineNumbers([]);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setPagePayload(null);
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, selectedToken]);

  function toggleExercise(line) {
    if (!line.score) return;

    setSelectedLineNumbers((current) =>
      current.includes(line.lineNumber)
        ? current.filter((lineNumber) => lineNumber !== line.lineNumber)
        : [...current, line.lineNumber]
    );
  }

  function practiceSelectedExercises() {
    const selectedLines = selectedLineNumbers
      .map((lineNumber) =>
        pagePayload?.page?.lines?.find((line) => line.lineNumber === lineNumber)
      )
      .filter((line) => Boolean(line?.score));

    if (!selectedLines.length) return;

    dispatch(
      scoreActions.updateScore({
        score: createContinuousPageScore(selectedLines),
        name: `Page ${pagePayload.pageRef.page}: exercises ${selectedLineNumbers.join(", ")}`,
        tempo: selectedLines[0].tempo || 80,
        mutations: [],
      })
    );
    router.push("/");
  }

  const selectedPage = pagePayload?.page || null;
  const selectedPageRef = pagePayload?.pageRef || null;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <p style={styles.title}>{BOOK_TITLE}</p>
        <p style={styles.subtitle}>Choose rhythms to practice together</p>
      </div>

      {loadingPage && <p style={styles.message}>Loading book page…</p>}

      {error && <p style={{ ...styles.message, ...styles.error }}>{error}</p>}

      {!loadingPage && !error && !selectedPage && (
        <p style={styles.message}>
          Scan a book QR code to choose rhythms from that page.
        </p>
      )}

      {!loadingPage && !error && selectedPage && (
        <>
          <p style={styles.prompt}>
            {getPageLabel(selectedPageRef)} — tap rhythms in the order you want to practice them:
          </p>
          <div style={styles.selectionActions}>
            <p style={styles.selectionSummary}>
              {selectedLineNumbers.length
                ? `${selectedLineNumbers.length} rhythm${selectedLineNumbers.length === 1 ? "" : "s"} selected`
                : "No rhythms selected yet"}
            </p>
            {selectedLineNumbers.length > 0 && (
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                type="button"
                onClick={() => setSelectedLineNumbers([])}
              >
                Clear
              </button>
            )}
            <button
              style={{
                ...styles.button,
                ...(!selectedLineNumbers.length ? styles.disabledButton : {}),
              }}
              type="button"
              onClick={practiceSelectedExercises}
              disabled={!selectedLineNumbers.length}
            >
              Practice selected rhythms
            </button>
          </div>
          <div style={styles.list}>
            {selectedPage.lines.map((line) => {
              const hasScore = Boolean(line.score);
              const selectionIndex = selectedLineNumbers.indexOf(line.lineNumber);
              const isSelected = selectionIndex >= 0;

              return (
                <div key={line.lineNumber} style={styles.exerciseWrap}>
                  <span aria-hidden="true" style={styles.exerciseNumber}>
                    {line.lineNumber}
                  </span>
                  <button
                    style={{
                      ...styles.exerciseRow,
                      ...(isSelected ? styles.exerciseRowSelected : {}),
                      ...(hasScore ? {} : styles.exerciseButtonEmpty),
                    }}
                    onClick={() => toggleExercise(line)}
                    disabled={!hasScore}
                    aria-label={`Exercise ${line.lineNumber}${isSelected ? `, selection ${selectionIndex + 1}` : ""}`}
                    aria-pressed={isSelected}
                    type="button"
                  >
                    <RhythmPreview line={line} />
                    <span aria-hidden="true" style={styles.selectionOrderSlot}>
                      {isSelected && (
                        <span style={styles.selectionOrder}>
                          {selectionIndex + 1}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
