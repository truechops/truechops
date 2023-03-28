import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../store/score";
import { useRouter } from "next/router";
import { makeStyles } from "@material-ui/styles";
import Box from '@material-ui/core/Box';

import Paper from "@material-ui/core/Paper";
import { DEFAULT_TEMPO } from "../../consts/score";

import { scrubTypename } from "../../helpers/mongodb";
import { appActions } from "../../store/app";

import { drawScore, initialize } from "../../lib/vexflow";
import { mutate } from "../../services/mutate/mutate-service";

import { getScoreVoices } from "../../utils/score";

import { FaForward, FaDrum } from "react-icons/fa";
import IconButton from "@material-ui/core/IconButton";

export default function Main({rhythms}) {
  const [svgConfig, setSvgConfig] = useState(getSvgConfig(window.innerWidth));
  const repeat = useSelector((state) => state.score.present.repeat);
  const router = useRouter();
  const dispatch = useDispatch();

  function practiceRhythm(score, name, tempo, mutations) {
    const scrubbedScore = scrubTypename(score);
    dispatch(
      scoreActions.updateScore({ score: scrubbedScore, name, tempo, mutations })
    );
    router.push({pathname: "/", query: {doDynamic: true}});
  }

  const useStyles = makeStyles((theme) => ({
    root: {
      height: window.innerHeight - (2 * theme.mixins.toolbar.minHeight)
    },
    listItem: {
      cursor: "pointer",
      margin: theme.spacing(1),
    },
    listItemText: {
      color: "black",
    },
  }));

  function redrawScore(id, rhythm) {
    const {score, mutations} = rhythm;
    document.getElementById(id).innerHTML = null;
    const { renderer, context } = initialize(id);

    if(mutations && mutations.length) {
       mutate(score, mutations, 1, Object.keys(getScoreVoices(score)));
    }

    drawScore(
      renderer,
      context,
      score,
      0,
      () => {},
      svgConfig.width,

      //JARED_TODO: what to do about this 'repeat'?
      repeat,
      svgConfig.scale
    );
  }

  useEffect(async () => {
    for (let rhythm of rhythms) {
      const { renderer, context } = initialize(`rhythm-${rhythm.name}`);
      drawScore(
        renderer,
        context,
        rhythm.score,
        0,
        () => {},
        svgConfig.width,
        repeat,
        svgConfig.scale
      );
    }

    dispatch(appActions.setPageLoaded());
  }, [svgConfig]);

  function getSvgConfig(windowWidth) {
    if(windowWidth < 900) {
      return {width: 200, scale: 0.8};
    } else {
       return {width: 275, scale: 1};
    }
    // return {width: 250, scale: 1}
  }

  const updateDimensions = useCallback(() => {
    setSvgConfig(getSvgConfig(window.innerWidth));
  }, []);

  window.addEventListener("resize", updateDimensions);
//JARED_TODO: why isn't 32nd mutate working?
  const classes = useStyles();
  return (
    <>
      <section style={{ textAlign: "center", overflowY: "auto" }} className={classes.root}>
       <div className="vexflow-wrapper">
      <div style={{ width: '100%' }}>
      <Box
        display="flex"
        flexWrap="wrap"
        justifyContent="center"
        p={1}
        m={1}
        sx={{ maxWidth: 300, background: 'inherit'}}
      >
        {rhythms.length > 0 && 
            rhythms.map((rhythm) => (
            <Box p={1}>
                {/* This wrapper and the key ensure that content isn't duplicated when the screen resizes*/}
                <Paper
                  style={{cursor: "pointer"}}
                  onClick={practiceRhythm.bind(
                    null,
                    rhythm.score,
                    rhythm.name,
                    rhythm.tempo ?? DEFAULT_TEMPO,
                    rhythm.mutations
                  )}>
                   <div id={`rhythm-${rhythm.name}`} key={Math.random().toString()} />
                </Paper>
                  <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                  <IconButton onClick={practiceRhythm.bind(
                    null,
                    rhythm.score,
                    rhythm.name,
                    rhythm.tempo ?? DEFAULT_TEMPO,
                    rhythm.mutations
                  )}><FaDrum/></IconButton>
                    {/* <button onClick={redrawScore.bind(null, `rhythm-${rhythm.name}`, rhythm)}>regenerate</button> */}
                    <IconButton onClick={redrawScore.bind(null, `rhythm-${rhythm.name}`, rhythm)}><FaForward/></IconButton>
                  </div>
              </Box>
          ))}
          </Box>
          </div>
          </div>
      </section>
    </>
  );
}
