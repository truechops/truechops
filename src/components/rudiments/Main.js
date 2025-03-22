import { useState, useEffect } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { makeStyles, useTheme } from "@mui/styles";
import { useDispatch } from "react-redux";
import { appActions } from "../../store/app";
import hybridRudiments from "../../../data/rudiments/hybrid/all";
import essentialRudiments from "../../../data/rudiments/essential/all";
import dynamic from "next/dynamic";

const DynamicMain = dynamic(() => import("../rhythms/Main"), {
  ssr: false,
});

function getSvgConfig(windowWidth) {
  return { width: 530, scale: 0.7, hResize: 0.75, vResize: 0.75 }
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
  const [selectedRudiments, setSelectedRudiments] = useState(0);

  function changeSelectedRudiments(event, newValue) {
    setSelectedRudiments(newValue);
  }

  function getHeight(window) {
    return window.innerHeight - theme.mixins.toolbar.minHeight - 28;
  }

  function getRudiments() {
    if (selectedRudiments == 0) {
      return (
        <DynamicMain
          getHeight={getHeight}
          rhythms={essentialRudiments}
          getSvgConfig={getSvgConfig}
        />
      );
    } else {
      return (
        <DynamicMain
          rhythms={hybridRudiments}
          getHeight={getHeight}
          getSvgConfig={getSvgConfig}
        />
      );
    }
  }

  return (
    <>
      {" "}
      <Tabs
        // style={{ position: "fixed", bottom: 0, marginBottom:  }}
        classes={{ root: classes.root, flexContainer: classes.flexContainer }}
        value={selectedRudiments}
        // classes={{ root: classes.root, flexContainer: classes.flexContainer }}
        onChange={changeSelectedRudiments}
        // aria-label="simple tabs example"
        // classes={{ root: classes.tabs, scroller: classes.scroller }}
        variant={"scrollable"}
        scrollButtons={"auto"}
        centered
      >
        <Tab key={"rudiments-essential"} label="ESSENTIAL" {...a11yProps(0)} />
        <Tab key={"rudiments-hybrid"} label="HYBRID" {...a11yProps(1)} />
      </Tabs>
      {getRudiments()}
    </>
  );
}
