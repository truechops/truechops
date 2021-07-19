import { useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { appActions } from "../../store/app";

import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Drawer from "@material-ui/core/Drawer";
import CssBaseline from "@material-ui/core/CssBaseline";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/IconButton";
import ErrorBoundary from "../error/ErrorBoundary";

import dynamic from "next/dynamic";

import { GiHamburgerMenu } from "react-icons/gi";
import { FiSettings } from "react-icons/fi";
import { Typography } from "@material-ui/core";
import Dialog from '../ui/Dialog';

// const searchClient = algoliasearch(
//   "7VD37OIZBX",
//   "075e3727b35d845338b30a28b5a54562"
// );

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
}));

//Each page has its own top toolbar. Render it dynamically based on which page you are on.
const DynamicComposeTopToolbar = dynamic(() => import("../compose/TopToolbar"));
const DynamicComposeSidebar = dynamic(() => import("../compose/Sidebar"));

export default function Header() {
  const classes = useStyles();
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const { setNavOpen } = appActions;
  const dispatch = useDispatch();

  const getToolbarContent = () => {
    if (router.pathname === "/") {
      return (
        <ErrorBoundary component="compose toolbar">
          <DynamicComposeTopToolbar />
        </ErrorBoundary>
      );
    }
  };

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
        <Toolbar>
          
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={() => dispatch(setNavOpen(true))}
            edge="start"
          >
            <GiHamburgerMenu />
          </IconButton>
          {getToolbarContent()}
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
    </>
  );
}
