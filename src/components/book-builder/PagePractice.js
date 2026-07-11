import { useEffect, useId, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";
import { drawScore, initialize } from "../../lib/vexflow";
import { BOOK_TITLE } from "./book-data";

const styles = {
  page: {
    padding: "20px 16px",
    maxWidth: "540px",
    margin: "0 auto",
    fontFamily: "Georgia, serif",
  },
  header: {
    marginBottom: "20px",
    borderBottom: "2px solid #222",
    paddingBottom: "12px",
  },
  title: {
    fontSize: "20px",
    fontWeight: "bold",
    margin: "0 0 4px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#555",
    margin: 0,
  },
  prompt: {
    fontSize: "14px",
    color: "#333",
    marginBottom: "16px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  exerciseRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "78px",
    width: "100%",
    padding: "6px 8px",
    fontFamily: "Georgia, serif",
    border: "1px solid #d7d7d7",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    color: "#111",
    textAlign: "left",
  },
  exerciseNumber: {
    alignItems: "center",
    background: "#f2f2f2",
    border: "1px solid #ddd",
    borderRadius: "6px",
    display: "flex",
    flex: "0 0 34px",
    fontSize: "16px",
    fontWeight: "bold",
    height: "34px",
    justifyContent: "center",
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

function RhythmPreview({ line }) {
  const reactId = useId();
  const previewId = `book-practice-preview-${reactId.replace(/:/g, "")}-${line.pageNumber}-${line.lineNumber}`;

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
        width: 720,
        scale: 0.58,
        hResize: 0.58,
        vResize: 0.58,
        justifyLastRow: true,
      },
      {}
    );
  }, [line.score, previewId]);

  if (!line.score) {
    return <span style={styles.blankPreview}>Blank</span>;
  }

  return <div id={previewId} style={styles.preview} />;
}

export default function PagePractice({ pageNumber }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const router = useRouter();

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
            <button
              key={line.lineNumber}
              style={{
                ...styles.exerciseRow,
                ...(hasScore ? {} : styles.exerciseButtonEmpty),
              }}
              onClick={() => hasScore && practiceExercise(line)}
              disabled={!hasScore}
              aria-label={`Exercise ${line.lineNumber}`}
            >
              <span style={styles.exerciseNumber}>{line.lineNumber}</span>
              <RhythmPreview line={line} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
