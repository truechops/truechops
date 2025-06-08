import { useState } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { appActions } from "../../store/app";
import Dialog from "../ui/Dialog";

import React from "react";
import { makeStyles, useTheme } from "@mui/styles";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ErrorBoundary from "../error/ErrorBoundary";
import { FaDrum, FaUser } from "react-icons/fa";

import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import dynamic from "next/dynamic";

import { GiHamburgerMenu } from "react-icons/gi";
import { FiSettings } from "react-icons/fi";
import { CircularProgress, Typography } from "@mui/material";
import { findLastIndex } from "lodash";

const useStyles = makeStyles((theme) => ({
  appBar: {
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  tabs: {
    width: '100px',
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
    display: "flex",
    justifyContent: "center",
  },
}));

const DynamicComposeSidebar = dynamic(() => import("../compose/Sidebar"));

export default function Header() {
  const classes = useStyles();
  const router = useRouter();
  const theme = useTheme();
  const loaded = useSelector((state) => state.app.loaded);
  const currentUser = useSelector((state) => state.realm.currentUser);

  const onAreaSelected = (event, newValue) => {
    if (newValue === 0 && router.pathname != '/exercises') {
      router.push("/exercises");
    } else if (newValue === 1 && router.pathname != '/') {
      router.push("/");
    } else if (newValue === 2 && router.pathname != '/rudiments') {
      router.push("/rudiments");
    } else if (newValue === 3 && router.pathname != '/byos') {
      router.push("/byos")
    } else if (newValue === 4 && router.pathname != '/library') {
      if (!currentUser) {
        router.push("/login");
      } else {
        router.push("/library");
      }
    }
  };

  let selectedArea = 0;
  if(router.pathname === '/') {
    selectedArea = 1;
  } else if(router.pathname === '/rudiments') {
    selectedArea = 2;
  } else if(router.pathname === '/byos') {
    selectedArea = 3
  } else if(router.pathname === '/library' || router.pathname == '/login') {
    selectedArea = 4;
  }

  const { setNavOpen } = appActions;
  const dispatch = useDispatch();

  function a11yProps(index) {
    return {
      id: `simple-tab-${index}`,
      "aria-controls": `simple-tabpanel-${index}`,
    };
  }

  const [mustBeLoggedInModalOpen, setMustBeLoggedInModalOpen] = useState(false);

  return (
    <>
      <CssBaseline />
      <AppBar position="fixed" style={{
        backgroundColor: 'black',
        color: 'white'
        }}>
        <Toolbar
          style={{
            justifyContent: "space-between",
          }}
        >
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={() => dispatch(setNavOpen(true))}
            edge="start"
          >
            <GiHamburgerMenu />
          </IconButton>

          <Tabs
            value={selectedArea}
            textColor="secondary"
            onChange={onAreaSelected}
            // aria-label="simple tabs example"
            //variant={"scrollable"}
            scrollButtons={"auto"}
            centered
            edge="center"
          >
            <Tab style={{ minWidth: 50, color: 'white'}} key={"header-exercises"} label="DRILLS" {...a11yProps(0)} />
            <Tab style={{ minWidth: 50, color: 'white' }} key={"header-score"} label="SCORE" {...a11yProps(1)} />
            <Tab style={{ minWidth: 50, color: 'white' }} key={"header-rudiments"} label="RUDIMENTS" {...a11yProps(2)} />
            <Tab style={{ minWidth: 50, color: 'white' }} key={"header-byos"} label="BYOS" {...a11yProps(3)} />
            <Tab edge="end" style={{ minWidth: 50, color: 'white' }} key={"header-saved"} icon={<FaUser />}  {...a11yProps(4)} />
          </Tabs>
          <div class="right"></div>
        </Toolbar>
        
      </AppBar>
      <Dialog
        onOk={setMustBeLoggedInModalOpen.bind(null, false)}
        message="Log in to view your library!"
        isOpen={mustBeLoggedInModalOpen}
        setIsOpen={setMustBeLoggedInModalOpen}
      />
      <div className={classes.drawerHeader} />
      {!loaded && <CircularProgress style={theme.spinner} />}
    </>
  );
}
