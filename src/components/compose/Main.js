import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import Score from "./Score";
import ScoreToolbar from "./ScoreToolbar";
import { ScoreToolsProvider } from "./score-tools";
import ErrorBoundary from "../error/ErrorBoundary";
import BookBuilderPanel from "../book-builder/Main";
import styles from "./score-workspace.module.css";

export default function Main(props) {
  const router = useRouter();
  const isDynamicRhythm = props && props.isDynamicRhythm;
  const bookOpen = Boolean((props && props.showBookBuilder) || router.query.b === '1');
  const score = useSelector((state) => state.score.present.score);
  const scoreRoot = useRef(null);
  const [scoreWidth, setScoreWidth] = useState(null);

  // The score is laid out to the card's width, so it reflows when the card resizes.
  useEffect(() => {
    const element = scoreRoot.current;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(element);
      setScoreWidth(Math.floor(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <ScoreToolsProvider>
      <main className={styles.workspace}>
        <ErrorBoundary component="compose toolbar">
          <ScoreToolbar initialTab={props && props.initialTab != null ? props.initialTab : 1} />
        </ErrorBoundary>
        <div className={styles.body}>
          <section id="score-root" ref={scoreRoot} className={styles.scoreCard} aria-label="Score">
            <ErrorBoundary component="compose">
              {scoreWidth > 0 && <Score measureTools scoreRootId="score-root" id={"vexflow"} score={score} containerWidth={scoreWidth}
                isDynamicRhythm={isDynamicRhythm} titleClass={styles.scoreTitle} />}
            </ErrorBoundary>
          </section>
          {bookOpen && (
            <ErrorBoundary component="book builder">
              <BookBuilderPanel />
            </ErrorBoundary>
          )}
        </div>
      </main>
    </ScoreToolsProvider>
  );
}
