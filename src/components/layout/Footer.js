/**Not currently used. Kept here in case we want to move stuff back to the footer */

import router, { useRouter } from "next/router";
import { useSelector, useDispatch } from "react-redux";
import { appActions } from "../../store/app";
import { makeStyles, useTheme } from "@material-ui/core/styles";

import React from "react";

import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

export default function Footer() {
  const useTabStyles = makeStyles({
    root: {
      justifyContent: "center",
      width: "100%",
    },
    flexContainer: {
      display: "flex",
      justifyContent: "center",
    },
    scroller: {
      flexGrow: "0",
    },
  });

  const classes = useTabStyles();
  const router = useRouter();
  const onAreaSelected = (event, newValue) => {
    if (newValue === 0 && router.pathname != '/exercises') {
      router.push("/exercises");
    } else if (newValue === 1 && router.pathname != '/') {
      router.push("/");
    } else if (newValue === 2 && router.pathname != '/rudiments') {
      router.push("/rudiments");
    }
  };

  let selectedArea = 0;
  if(router.pathname === '/') {
    selectedArea = 1;
  } else if(router.pathname === '/rudiments') {
    selectedArea = 2;
  }

  const dispatch = useDispatch();
  function a11yProps(index) {
    return {
      id: `simple-tab-${index}`,
      "aria-controls": `simple-tabpanel-${index}`,
    };
  }

  return (
    <Tabs
      style={{ position: "fixed", bottom: 0 }}
      value={selectedArea}
      classes={{ root: classes.root, flexContainer: classes.flexContainer }}
      onChange={onAreaSelected}
      // aria-label="simple tabs example"
      // classes={{ root: classes.tabs, scroller: classes.scroller }}
      variant={"scrollable"}
      scrollButtons={"auto"}
      centered
    >
      <Tab key={"footer-exercises"} label="EXERCISES" {...a11yProps(0)} />
      <Tab key={"footer-edit"} label="SCORE" {...a11yProps(1)} />
      <Tab key={"footer-rudiments"} label="RUDIMENTS" {...a11yProps(2)} />
    </Tabs>
  );
}
