import { useState, useEffect } from "react";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { useDispatch } from "react-redux";
import { appActions } from "../../store/app";
import drumsetExercises from "../../../data/exercises/drumset/all";
import snareExercises from "../../../data/exercises/snare/all";
import dynamic from "next/dynamic";

const DynamicMain = dynamic(() => import("../rhythms/Main"), {
  ssr: false,
});

function getSvgConfig(windowWidth) {
  return { width: 530, scale: 0.75, hResize: 0.65, vResize: 0.75 };
}

const useTabStyles = makeStyles((theme) => ({
  root: {
    justifyContent: "center",
    width: "100%",
    position: "fixed",
    background: "#fafafa",
    bottom: 0,
  },
  flexContainer: {
    display: "flex",
    justifyContent: "center",
  },
  scroller: {
    flexGrow: "0",
  },
}));

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

export default function main() {
  const dispatch = useDispatch();
  const theme = useTheme();
  useEffect(() => {
    dispatch(appActions.setPageLoaded());
  }, [dispatch]);

  const classes = useTabStyles();
  const [selectedExercises, setSelectedExercises] = useState(0);

  function changeSelectedRudiments(event, newValue) {
    setSelectedExercises(newValue);
  }

  function getHeight(window) {
    return window.innerHeight - theme.mixins.toolbar.minHeight - 28;
  }

  function getExercises() {
    if (selectedExercises == 0) {
      return (
        <DynamicMain
          getHeight={getHeight}
          rhythms={snareExercises}
          getSvgConfig={getSvgConfig}
        />
      );
    } else {
      return (
        <DynamicMain
          rhythms={drumsetExercises}
          getHeight={getHeight}
          getSvgConfig={getSvgConfig}
        />
      );
    }
  }

  return (
    <>
      <Tabs
        // style={{ position: "fixed", bottom: 0, marginBottom:  }}
        classes={{ root: classes.root, flexContainer: classes.flexContainer }}
        value={selectedExercises}
        // classes={{ root: classes.root, flexContainer: classes.flexContainer }}
        onChange={changeSelectedRudiments}
        // aria-label="simple tabs example"
        // classes={{ root: classes.tabs, scroller: classes.scroller }}
        variant={"scrollable"}
        scrollButtons={"auto"}
        centered
      >
        <Tab key={"exercises-snare"} label="SNARE" {...a11yProps(0)} />
        <Tab key={"exercises-drumset"} label="DRUMSET" {...a11yProps(1)} />
      </Tabs>
      {getExercises()}
    </>
  );
}
