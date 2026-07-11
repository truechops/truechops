import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { appActions } from "../../store/app";
import { scoreActions } from "../../store/score";
import { drawScore, initialize } from "../../lib/vexflow";
import { BOOK_TITLE } from "./book-data";

const styles = {
  page: {
    boxSizing: "border-box",
    padding: "44px 24px",
    maxWidth: "960px",
    width: "100%",
    margin: "0 auto",
    fontFamily: "Georgia, serif",
  },
  header: {
    marginBottom: "40px",
    borderBottom: "4px solid #222",
    paddingBottom: "24px",
  },
  title: {
    fontSize: "34px",
    fontWeight: "bold",
    lineHeight: 1.15,
    margin: "0 0 16px",
  },
  subtitle: {
    fontSize: "25px",
    color: "#555",
    margin: 0,
  },
  prompt: {
    fontSize: "25px",
    color: "#333",
    marginBottom: "32px",
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
    fontSize: "16px",
    color: "#555",
    padding: "40px 0",
    textAlign: "center",
  },
};

const EDITOR_SCORE_SCALE = 0.75;
const VEXFLOW_RENDER_PADDING = 50;

function RhythmPreview({ line }) {
  const reactId = useId();
  const previewRef = useRef(null);
  const [previewWidth, setPreviewWidth] = useState(720);
  const previewId = `book-practice-preview-${reactId.replace(/:/g, "")}-${line.pageNumber}-${line.lineNumber}`;

  useEffect(() => {
    const previewElement = previewRef.current;
    if (!previewElement) {
      return;
    }

    const updatePreviewWidth = () => {
      const nextWidth = Math.floor(previewElement.getBoundingClientRect().width);
      if (!nextWidth) {
        return;
      }
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
    if (!line.score) {
      return;
    }

    const container = document.getElementById(previewId);
    if (!container) {
      return;
    }

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

export default function PagePractice({ pageNumber }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    dispatch(appActions.setPageLoaded());
  }, [dispatch]);

  useEffect(() => {
    fetch("/api/book-builder")
      .then((r) => r.json())
      .then(({ book }) => {
        const found = book?.pages?.find((p) => p.pageNumber === pageNumber) ?? null;
        setPage(found);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [pageNumber]);

  function practiceExercise(line) {
    if (!line.score) return;
    dispatch(
      scoreActions.updateScore({
        score: line.score,
        name: line.title || `Exercise ${line.lineNumber}`,
        tempo: line.tempo || 80,
        mutations: [],
      })
    );
    router.push("/");
  }

  if (loading) {
    return <p style={styles.message}>Loading…</p>;
  }

  if (error) {
    return <p style={styles.message}>Could not load book data.</p>;
  }

  if (!page) {
    return <p style={styles.message}>Page {pageNumber} not found.</p>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <p style={styles.title}>{BOOK_TITLE}</p>
        <p style={styles.subtitle}>Page {pageNumber} — choose an exercise to practice</p>
      </div>
      <p style={styles.prompt}>Tap a rhythm to load that exercise:</p>
      <div style={styles.list}>
        {page.lines.map((line) => {
          const hasScore = Boolean(line.score);
          return (
            <div key={line.lineNumber} style={styles.exerciseWrap}>
              <span aria-hidden="true" style={styles.exerciseNumber}>{line.lineNumber}</span>
              <button
                style={{
                  ...styles.exerciseRow,
                  ...(hasScore ? {} : styles.exerciseButtonEmpty),
                }}
                onClick={() => hasScore && practiceExercise(line)}
                disabled={!hasScore}
                aria-label={`Exercise ${line.lineNumber}`}
              >
                <RhythmPreview line={line} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
