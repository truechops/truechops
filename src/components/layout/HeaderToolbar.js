import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { appActions } from "../../store/app";
import Dialog from "../ui/Dialog";

import React from "react";
import { makeStyles, useTheme } from "@mui/styles";
import CssBaseline from "@mui/material/CssBaseline";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import { FaUser } from "react-icons/fa";

import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import { GiHamburgerMenu } from "react-icons/gi";
import { CircularProgress } from "@mui/material";

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
  communityTabs: {
    '@media (max-width:600px)': { display: 'none' },
  },
  communityMobileTitle: {
    display: 'none',
    '@media (max-width:600px)': {
      display: 'block', fontSize: 13, fontWeight: 600, letterSpacing: '.3px',
      textDecoration: 'none', color: 'inherit',
    },
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

export default function Header() {
  const classes = useStyles();
  const router = useRouter();
  const communityPage = ['/discover','/search','/profile','/library','/u/[handle]','/rhythms/[id]'].includes(router.pathname);
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
    } else if (newValue === 4 && router.pathname != '/profile') {
      router.push("/profile");
    } else if (newValue === 5 && router.pathname != '/discover') {
      router.push("/discover");
    }
  };

  let selectedArea = 0;
  if(router.pathname === '/') {
    selectedArea = 1;
  } else if(router.pathname === '/rudiments') {
    selectedArea = 2;
  } else if(router.pathname === '/byos') {
    selectedArea = 3;
  } else if(['/library','/profile','/u/[handle]','/login'].includes(router.pathname)) {
    selectedArea = 4;
  } else if(['/discover','/search','/rhythms/[id]'].includes(router.pathname)) {
    selectedArea = 5;
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
        backgroundColor: communityPage ? '#fcfaf9' : 'black',
        color: communityPage ? '#29252a' : 'white',
        ...(communityPage ? { boxShadow: 'none', borderBottom: '1px solid #eee8e7' } : {})
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

          {communityPage && <Link href="/discover" className={classes.communityMobileTitle}>TrueChops</Link>}
          <Tabs
            className={communityPage ? classes.communityTabs : undefined}
            TabIndicatorProps={communityPage ? { style: { backgroundColor: '#aa3e4b', height: 2 } } : undefined}
            value={selectedArea}
            textColor="secondary"
            onChange={onAreaSelected}
            variant={"scrollable"}
            scrollButtons={"auto"}
            edge="center"
          >
            <Tab style={{ minWidth: 50, color: 'inherit'}} key={"header-exercises"} label="DRILLS" {...a11yProps(0)} />
            <Tab style={{ minWidth: 50, color: 'inherit' }} key={"header-score"} label="SCORE" {...a11yProps(1)} />
            <Tab style={{ minWidth: 50, color: 'inherit' }} key={"header-rudiments"} label="RUDIMENTS" {...a11yProps(2)} />
            <Tab style={{ minWidth: 50, color: 'inherit' }} key={"header-byos"} label="BYOS" {...a11yProps(3)} />
            <Tab style={{ minWidth: 50, color: 'inherit' }} key="header-profile" aria-label="My profile and rhythms" icon={<FaUser />} {...a11yProps(4)} />
            <Tab style={{ minWidth: 50, color: 'inherit' }} key="header-community" label="COMMUNITY" {...a11yProps(5)} />
          </Tabs>
          <div className="right"></div>
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
