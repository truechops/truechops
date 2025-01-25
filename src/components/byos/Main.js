import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../store/score";
import { useRouter } from "next/router";
import { makeStyles, useTheme } from "@material-ui/styles";
import Box from "@material-ui/core/Box";
import ErrorBoundary from "../error/ErrorBoundary";
import Legend from "../../../data/byos/alphabet/legend.js";
import LegendDialog from "./legend-dialog.js";

import $ from "jquery";
import Paper from "@material-ui/core/Paper";
import { DEFAULT_TEMPO } from "../../consts/score";

import byosAlphabet from "../../../data/byos/alphabet/all.js";
import { scrubTypename } from "../../helpers/mongodb";
import { appActions } from "../../store/app";
import { drawScore, initialize } from "../../lib/vexflow";
import Score from "../compose/Score";
import { map as byosAlphabetMap } from "../../../data/byos/alphabet/all.js";
import backstickHead from "../../../data/byos/custom-heads/backstick.js";

function getSvgConfig() {
  return { width: 530, scale: 0.7, hResize: 0.75, vResize: 0.75 };
}

export default function Main() {
  const [svgConfig, setSvgConfig] = useState(getSvgConfig());
  const [alphabetRendered, setAlphabetRendered] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  // -- Track the word input in state
  const [word, setWord] = useState("");

  const [scorePreview, setScorePreview] = useState(null);
  const [alphabetShown, setAlphabetShown] = useState(true);

  const router = useRouter();
  const dispatch = useDispatch();
  const repeat = useSelector((state) => state.score.present.repeat);
  const theme = useTheme();

  function getHeight() {
    return window.innerHeight - theme.mixins.toolbar.minHeight - 28;
  }

  // Update the "word" in local state and build the combined "score"
  function updateScoreFromWord(e) {
    const inputValue = e.target.value;
    setWord(inputValue);

    if (!inputValue) {
      // If input is empty, clear the preview
      setScorePreview(null);
      return;
    }

    let composedScore = null;
    for (let c = 0; c < inputValue.length; c++) {
      const char = inputValue[c];

      // Skip unknown characters
      if (!byosAlphabetMap[char]) continue;

      if (c === 0) {
        composedScore = { ...byosAlphabetMap[char].score };
      } else {
        composedScore.measures = composedScore.measures.concat(
          ...byosAlphabetMap[char].score.measures.map((m) => ({ ...m }))
        );
      }
    }
    if (composedScore) {
      practiceRhythm(composedScore);
    } else {
      setScorePreview(null);
    }
  }

  function practiceRhythm(score) {
    const scrubbedScore = scrubTypename(score);
    setScorePreview(scrubbedScore);
  }

  function updateScore() {
    const scrubbedScore = scrubTypename(scorePreview);
    dispatch(
      scoreActions.updateScore({
        score: scrubbedScore,
        name: word,
        tempo: 120,
        mutations: [],
      })
    );
    router.push("/");
  }

  const useStyles = makeStyles((theme) => ({
    root: {
      height: getHeight(window),
      minHeight: "100vh",
      backgroundImage: `url(/assets/byos-poster.png);`,
      backgroundColor: "rgba(255,255,255,0.95);",
      backgroundBlendMode: "lighten",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    alphabet: {
      height: "60vh",
      overflow: "scroll",
    },
    alphabetHeader: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "12px",
    },
    byosButton: {
      height: "30px",
      fontSize: "20px",
    },
    wordInput: {
      margin: "8px 8px 20px 8px;",
      height: "30px",
      fontSize: "20px",
      padding: "4px",
      "&::placeholder": {
        fontStyle: "italic", // Makes placeholder italic
      },
    },
    listItem: {
      cursor: "pointer",
      margin: theme.spacing(1),
    },
    listItemText: {
      color: "black",
    },
  }));

  const useTabStyles2 = makeStyles((theme) => ({
    buttons: {
      position: "fixed",
      left: "51%",
      transform: "translateX(-50%)",
      bottom: 0,
    },
    root: {
      flexDirection: "column",
      display: "flex",
      height: "100%",
    },
    score: {
      width: "100%",
      overflow: "auto",
      flex: 1,
      zIndex: 1,
    },
    vexflowWrapper: {
      [theme.breakpoints.down("sm")]: {
        height: `calc(${window.innerHeight}px - 32px - ${
          3 * theme.mixins.toolbar.minHeight
        }px - 12px)`,
      },
      [theme.breakpoints.up("sm")]: {
        height: `calc(${window.innerHeight}px - 32px - ${
          3 * theme.mixins.toolbar.minHeight
        }px - 12px)`,
      },
    },
    vexflow: {
      [theme.breakpoints.down("sm")]: {
        height: `100%`,
      },
      [theme.breakpoints.up("sm")]: {
        height: `100%`,
      },
    },
    toolbar: {
      display: "flex",
      justifyContent: "center",
    },
  }));

  const classes = useStyles();
  const classes2 = useTabStyles2();

  useLayoutEffect(() => {
    if (!alphabetRendered) {
      for (let rhythm of byosAlphabet) {
        const container = document.getElementById(`rhythm-${rhythm.id}`);
        if (container) {
          container.innerHTML = "";
        }

        const { renderer, context } = initialize(`rhythm-${rhythm.id}`);
        const draw = async () => {
          drawScore(renderer, context, rhythm.score, 0, () => {}, svgConfig, repeat);
          // $('.vf-notehead path').replaceWith(backstickHead)
        };
        draw();
      }

      setAlphabetRendered(true);
    }

    dispatch(appActions.setPageLoaded());
  }, [alphabetShown, dispatch, repeat, svgConfig]);

  const updateDimensions = useCallback(() => {
    setSvgConfig(getSvgConfig());
  }, []);

  useEffect(() => {
    window.addEventListener("resize", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, [updateDimensions]);

  return (
    <>
      <section style={{ textAlign: "center", overflowY: "auto" }} className={classes.root}>
        <div className={classes.alphabetHeader}>
          <h2>BYOS Alphabet</h2>
          <button className={classes.byosButton} onClick={() => setAlphabetShown(!alphabetShown)}>
            {alphabetShown ? "Hide" : "Show"}
          </button>
          <button className={classes.byosButton} onClick={() => setLegendOpen(true)}>
            Legend
          </button>
        </div>

        {/* Alphabet grid */}
        <div className={classes.alphabet} style={{ display: alphabetShown ? "" : "none" }}>
          <div style={{ width: "100%" }}>
            <Box
              display="flex"
              flexWrap="wrap"
              justifyContent="center"
              p={1}
              m={1}
              sx={{ background: "inherit" }}
            >
              {byosAlphabet.map((rhythm) => (
                <Box p={1} key={`box-${rhythm.id}`}>
                  <Paper
                    style={{ cursor: "pointer", border: "1px solid" }}
                    onClick={practiceRhythm.bind(
                      null,
                      rhythm.score,
                      rhythm.name,
                      rhythm.tempo ?? DEFAULT_TEMPO,
                      rhythm.mutations
                    )}
                  >
                    <div id={`rhythm-${rhythm.id}`} key={`rhythm-${rhythm.id}`} />
                  </Paper>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    {rhythm.name.toUpperCase()}
                  </div>
                </Box>
              ))}
            </Box>
          </div>
        </div>

        {/* Word input & Practice button */}
        <input
          id="byosWord"
          placeholder="enter word here"
          className={classes.wordInput}
          type="text"
          value={word}
          onChange={updateScoreFromWord}
        />
        <button
          className={classes.byosButton}
          onClick={updateScore}
          disabled={!word.trim().length}
        >
          Practice
        </button>

        {/* Score preview */}
        {scorePreview && (
          <div id="byos-score-root" className={classes2.score}>
            <ErrorBoundary component="compose">
              <Score
                scoreRootId="byos-score-root"
                id={"vexflow"}
                score={scorePreview}
                selectedTab={1}
                tabPanelHidden={false}
                isDynamicRhythm={false}
                vexflowClass={classes2.vexflow}
                vexflowWrapperClass={classes2.vexflowWrapper}
              />
            </ErrorBoundary>
          </div>
        )}
      </section>

      {/* Legend in a fixed container */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 999,
          backgroundColor: "white",
          border: "1px solid #ccc",
          borderRadius: "4px",
          padding: "8px",
        }}
      >
        <LegendDialog open={legendOpen} onClose={() => setLegendOpen(false)} />
      </div>
    </>
  );
}
