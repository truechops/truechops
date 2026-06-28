import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "10px",
  },
  exerciseButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "56px",
    fontSize: "22px",
    fontWeight: "bold",
    fontFamily: "Georgia, serif",
    border: "2px solid #222",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    color: "#111",
  },
  exerciseButtonEmpty: {
    border: "2px solid #ccc",
    color: "#bbb",
    cursor: "default",
    background: "#fafafa",
  },
  message: {
    fontSize: "16px",
    color: "#555",
    padding: "40px 0",
    textAlign: "center",
  },
};

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
      <p style={styles.prompt}>Tap a number to load that exercise:</p>
      <div style={styles.grid}>
        {page.lines.map((line) => {
          const hasScore = Boolean(line.score);
          return (
            <button
              key={line.lineNumber}
              style={{
                ...styles.exerciseButton,
                ...(hasScore ? {} : styles.exerciseButtonEmpty),
              }}
              onClick={() => hasScore && practiceExercise(line)}
              disabled={!hasScore}
              aria-label={`Exercise ${line.lineNumber}`}
            >
              {line.lineNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}
