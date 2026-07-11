import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { appActions } from "../../store/app";
import { scoreActions } from "../../store/score";
import { drawScore, initialize } from "../../lib/vexflow";
import {
  PRACTICE_SET_LIMIT,
  addPendingPageToPracticeSet,
  clearPendingPracticePage,
  readPendingPracticePage,
  readPracticeSlots,
  readSelectedPracticeToken,
  replacePracticeSlot,
  selectPracticePage,
  subscribeToPracticeSet,
} from "../../lib/practice-set-storage";
import { BOOK_TITLE } from "./book-data";

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
  slots: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "22px",
  },
  slotButton: {
    border: "1px solid #d5d5d5",
    borderRadius: "8px",
    background: "#fff",
    boxSizing: "border-box",
    color: "#151515",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    minHeight: "58px",
    padding: "8px 10px",
    textAlign: "left",
    width: "100%",
  },
  slotButtonActive: {
    borderColor: "#111",
    boxShadow: "inset 0 -3px 0 #1e88e5",
  },
  slotButtonEmpty: {
    background: "#f7f7f7",
    color: "#777",
    cursor: "default",
  },
  slotLabel: {
    display: "block",
    fontFamily: "Arial, sans-serif",
    fontSize: "11px",
    letterSpacing: "0.04em",
    marginBottom: "4px",
    textTransform: "uppercase",
  },
  slotTitle: {
    display: "block",
    fontSize: "18px",
    fontWeight: "bold",
    lineHeight: 1.1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pendingPanel: {
    border: "1px solid #cfcfcf",
    borderRadius: "8px",
    boxSizing: "border-box",
    marginBottom: "24px",
    padding: "16px",
    width: "100%",
  },
  pendingTitle: {
    fontSize: "22px",
    fontWeight: "bold",
    margin: "0 0 6px",
  },
  pendingText: {
    color: "#555",
    fontSize: "16px",
    lineHeight: 1.35,
    margin: "0 0 14px",
  },
  pendingActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
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
  replaceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "14px",
  },
  replaceCard: {
    border: "1px solid #dedede",
    borderRadius: "8px",
    padding: "12px",
  },
  replaceCardTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    margin: "0 0 10px",
  },
  prompt: {
    fontSize: "25px",
    color: "#333",
    marginBottom: "24px",
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
  if (!pageRef) {
    return "Empty";
  }

  return `Page ${pageRef.page}`;
}

function getSelectableToken(slots, preferredToken) {
  const activeTokens = slots.filter(Boolean).map((slot) => slot.token);

  if (preferredToken && activeTokens.includes(preferredToken)) {
    return preferredToken;
  }

  const storedToken = readSelectedPracticeToken();
  if (storedToken && activeTokens.includes(storedToken)) {
    return storedToken;
  }

  return activeTokens[0] || null;
}

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

export default function PagePractice() {
  const [slots, setSlots] = useState(() =>
    Array.from({ length: PRACTICE_SET_LIMIT }, () => null)
  );
  const [selectedToken, setSelectedToken] = useState(null);
  const [pendingPage, setPendingPage] = useState(null);
  const [pagePayload, setPagePayload] = useState(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const router = useRouter();

  const syncPracticeState = useCallback((preferredToken) => {
    const nextSlots = readPracticeSlots();
    const nextPendingPage = readPendingPracticePage();
    const nextSelectedToken = getSelectableToken(nextSlots, preferredToken);

    if (nextSelectedToken !== readSelectedPracticeToken()) {
      selectPracticePage(nextSelectedToken);
    }

    setSlots(nextSlots);
    setPendingPage(nextPendingPage);
    setSelectedToken(nextSelectedToken);
  }, []);

  useEffect(() => {
    dispatch(appActions.setPageLoaded());
  }, [dispatch]);

  useEffect(() => {
    syncPracticeState();
    return subscribeToPracticeSet(() => syncPracticeState());
  }, [syncPracticeState]);

  useEffect(() => {
    const activeTokens = slots.filter(Boolean).map((slot) => slot.token);

    if (!selectedToken || !activeTokens.includes(selectedToken)) {
      setPagePayload(null);
      setLoadingPage(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoadingPage(true);
    setError(null);

    fetch(`/api/book-pages/${encodeURIComponent(selectedToken)}`, {
      cache: "no-store",
      headers: {
        "x-practice-set-tokens": activeTokens.join(","),
      },
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
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setPagePayload(null);
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedToken, slots]);

  function selectSlot(slot) {
    if (!slot) {
      return;
    }

    selectPracticePage(slot.token);
    syncPracticeState(slot.token);
  }

  function addPendingPage() {
    const result = addPendingPageToPracticeSet();
    const nextToken = result.addedPage?.token || result.slots?.[result.selectedIndex]?.token;
    syncPracticeState(nextToken);
  }

  function replaceSlot(slotIndex) {
    const result = replacePracticeSlot(slotIndex, pendingPage);

    if (result.replacedPage) {
      dispatch(scoreActions.clearScore());
      setPagePayload(null);
    }

    const nextToken = result.addedPage?.token || result.slots?.[result.selectedIndex]?.token;
    syncPracticeState(nextToken);
  }

  function dismissPendingPage() {
    clearPendingPracticePage();
    syncPracticeState();
  }

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

  const activeSlotCount = slots.filter(Boolean).length;
  const hasEmptySlot = slots.some((slot) => !slot);
  const selectedPage = pagePayload?.page || null;
  const selectedPageRef = pagePayload?.pageRef || slots.find((slot) => slot?.token === selectedToken);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <p style={styles.title}>{BOOK_TITLE}</p>
        <p style={styles.subtitle}>Build your three-page Practice Set</p>
      </div>

      <div style={styles.slots} aria-label="Practice Set pages">
        {slots.map((slot, index) => {
          const isActive = Boolean(slot && slot.token === selectedToken);
          return (
            <button
              key={slot?.token || `empty-${index}`}
              style={{
                ...styles.slotButton,
                ...(isActive ? styles.slotButtonActive : {}),
                ...(!slot ? styles.slotButtonEmpty : {}),
              }}
              type="button"
              onClick={() => selectSlot(slot)}
              disabled={!slot}
            >
              <span style={styles.slotLabel}>Slot {index + 1}</span>
              <span style={styles.slotTitle}>{getPageLabel(slot)}</span>
            </button>
          );
        })}
      </div>

      {pendingPage && hasEmptySlot && (
        <div style={styles.pendingPanel}>
          <p style={styles.pendingTitle}>{getPageLabel(pendingPage)} is ready</p>
          <p style={styles.pendingText}>
            Add it to your Practice Set so it can be selected here on this device.
          </p>
          <div style={styles.pendingActions}>
            <button style={styles.button} type="button" onClick={addPendingPage}>
              Add to Practice Set
            </button>
            {activeSlotCount > 0 && (
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                type="button"
                onClick={dismissPendingPage}
              >
                Keep Current Set
              </button>
            )}
          </div>
        </div>
      )}

      {pendingPage && !hasEmptySlot && (
        <div style={styles.pendingPanel}>
          <p style={styles.pendingTitle}>Choose a page to replace</p>
          <p style={styles.pendingText}>
            Incoming: {getPageLabel(pendingPage)}. Your Practice Set is full.
            The page you remove will require rescanning before it can be opened
            here again.
          </p>
          <div style={styles.replaceGrid}>
            {slots.map((slot, index) => (
              <div key={slot?.token || index} style={styles.replaceCard}>
                <p style={styles.replaceCardTitle}>{getPageLabel(slot)}</p>
                <button
                  style={styles.button}
                  type="button"
                  onClick={() => replaceSlot(index)}
                >
                  Replace Slot {index + 1}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingPage && <p style={styles.message}>Loading Practice Set page…</p>}

      {error && (
        <p style={{ ...styles.message, ...styles.error }}>{error}</p>
      )}

      {!loadingPage && !error && !selectedPage && (
        <p style={styles.message}>
          Scan a book QR code to start building your three-page Practice Set.
        </p>
      )}

      {!loadingPage && !error && selectedPage && (
        <>
          <p style={styles.prompt}>
            {getPageLabel(selectedPageRef)} — tap a rhythm to load that exercise:
          </p>
          <div style={styles.list}>
            {selectedPage.lines.map((line) => {
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
                    type="button"
                  >
                    <RhythmPreview line={line} />
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
