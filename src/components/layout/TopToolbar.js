import { cloneElement, useState } from "react";
import useScrollTrigger from "@material-ui/core/useScrollTrigger";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { sideNavActions } from "../../store/navigation";
import ComposeToolbarItems from "../interaction/compose/Top";
import ComposeSideSheetItems from "../interaction/compose/Side";

import React from "react";
import clsx from "clsx";
import { makeStyles } from "@material-ui/core/styles";
import Drawer from "@material-ui/core/Drawer";
import CssBaseline from "@material-ui/core/CssBaseline";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/IconButton";

import { GiHamburgerMenu } from "react-icons/gi";
import { CgArrowLeftR } from "react-icons/cg";

// const searchClient = algoliasearch(
//   "7VD37OIZBX",
//   "075e3727b35d845338b30a28b5a54562"
// );

function ElevationScroll(props) {
  const { children } = props;
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  return cloneElement(children, {
    elevation: trigger ? 4 : 0,
  });
}

const drawerWidth = 256;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
  },
  appBar: {
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: drawerWidth,
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  drawerHeader: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: "flex-end",
  }
}));

export default function Header() {
  const classes = useStyles();
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const { setNavOpen } = sideNavActions;
  const dispatch = useDispatch();const [menuSheetOpen, setMenuSheetOpen] = useState(false);

  const getToolbarContent = () => {
    if (router.pathname === "/") {
      return <ComposeToolbarItems />;
    }
  };

  const getSideSheetContent = () => {
    let content = null;
    if (router.pathname === "/") {
      content = <ComposeSideSheetItems />;
    } 

    if (content != null) {
      return <>
        <Drawer
          anchor="right"
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        >
          {content}
        </Drawer>
        <IconButton
          color="inherit"
          aria-label="open more information"
          onClick={() => setSheetOpen(true)}
          edge="end"
        >
          <CgArrowLeftR />
        </IconButton>
      </>;
    } else {
      console.log('what');
      return null;
    }
  };

  return (
    <ElevationScroll>
      <div className={classes.root}>
        <CssBaseline />
        <AppBar
          position="fixed"
          className={clsx(classes.appBar, {
            [classes.appBarShift]: menuSheetOpen,
          })}
        >
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
            {getSideSheetContent()}
            
          </Toolbar>
          
        </AppBar>
        
        <div className={classes.drawerHeader} />
      </div>
    </ElevationScroll>
  );
}
