import { useState } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { appActions } from "../../store/app";

import React from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Drawer from "@material-ui/core/Drawer";
import CssBaseline from "@material-ui/core/CssBaseline";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/IconButton";
import ErrorBoundary from "../error/ErrorBoundary";
import { FaDrum } from "react-icons/fa";

import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import dynamic from "next/dynamic";

import { GiHamburgerMenu } from "react-icons/gi";
import { FiSettings } from "react-icons/fi";
import { CircularProgress, Typography } from "@material-ui/core";
import { findLastIndex } from "lodash";

const useStyles = makeStyles((theme) => ({
  appBar: {
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  drawerHeader: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    height: theme.mixins.toolbar.minHeight,
  },
  sidebar: {
    ...theme.sidebar,
  },
  pages: {
    display: 'flex',
    justifyContent: 'center'
  }
}));

const DynamicComposeSidebar = dynamic(() => import("../compose/Sidebar"));

export default function Header() {
  const classes = useStyles();
  const router = useRouter();
  const theme = useTheme();
  const loaded = useSelector(state => state.app.loaded);

  const [sheetOpen, setSheetOpen] = useState(false);
  const { setNavOpen } = appActions;
  const dispatch = useDispatch();

  const getSettingsContent = () => {
    if (router.pathname === "/") {
      return (
        <IconButton
          color="inherit"
          aria-label="open more information"
          onClick={() => setSheetOpen(true)}
          edge="end"
        >
          <FiSettings />
        </IconButton>
      );
    }
  };

  function a11yProps(index) {
    return {
      id: `simple-tab-${index}`,
      "aria-controls": `simple-tabpanel-${index}`,
    };
  }

  const getSidebarContent = () => {
    let content = null;
    if (router.pathname === "/") {
      content = <DynamicComposeSidebar />;
    }

    return content;
  };

  const getTitle = () => {
    let content = null;
    function typographyContent(title) {
    return <Typography style={{margin: 'auto'}} variant="h6" color="textSecondary">
        {title}
    </Typography>
    }
    if (router.pathname === "/library") {
      content = typographyContent("Library");
    } else if (router.pathname === "/profile") {
      content = typographyContent("Profile");
    }

    return content;
  }

  return (
    <>
      <CssBaseline />
      <AppBar position="fixed">
        <Toolbar style={{
          justifyContent: 'space-between'
        }}>
          
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={() => dispatch(setNavOpen(true))}
            edge="start"
          >
            <GiHamburgerMenu />
          </IconButton>
          {getTitle()}
          <Drawer
            anchor="right"
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            className={classes.sidebar}
            classes={{ paper: classes.sidebar }}
          >
            {getSidebarContent()}
          </Drawer>
          {getSettingsContent()}
        </Toolbar>
      </AppBar>
      <div className={classes.drawerHeader} />
      {!loaded && <CircularProgress style={theme.spinner}/>}
    </>
  );
}
