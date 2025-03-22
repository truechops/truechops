import { useRouter } from "next/router";
import { useSelector, useDispatch } from "react-redux";
import { appActions } from "../../store/app";
import { logout } from "../../store/realm-app";

import React from "react";
import { makeStyles } from "@mui/styles";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";

export default function Navigation() {
  const drawerWidth = 256;

  const useStyles = makeStyles((theme) => ({
    drawer: {
      width: drawerWidth,
    },
    drawerPaper: {
      width: drawerWidth,
    },
    drawerIcon: {
      marginRight: theme.spacing(2.5),
    },
  }));
  const classes = useStyles();
  const router = useRouter();
  const currentUser = useSelector((state) => state.realm.currentUser);
  const sideNavOpen = useSelector((state) => state.app.sideNavOpen);
  const { setNavOpen } = appActions;
  const dispatch = useDispatch();

  const navigationHandler = (url) => {
    router.push(url);
    dispatch(setNavOpen(false));
  };

  const logoutHandler = () => {
    dispatch(logout());
    router.push("/");
  };

  const iconSize = 24;

  return (
    <>
      <Drawer
        className={classes.drawer}
        classes={{
          paper: classes.drawerPaper,
        }}
        anchor="left"
        open={sideNavOpen}
        onClose={() => dispatch(setNavOpen(false))}
      >
        <Divider />
        <List>
          {/* <ListItem
          onClick={navigationHandler.bind(null, "/discover")}
          button
          key="discover"
        >
          <FaUsers className={classes.drawerIcon} size={iconSize} />
          <ListItemText primary="discover" />
        </ListItem> */}

          {/* <ListItem button key="mods" onClick={navigationHandler.bind(null, "/mods")}>
          <FaTools className={classes.drawerIcon} size={iconSize} />
          <ListItemText primary="mods" />
        </ListItem> */}

          {/* <ListItem button key="search" onClick={navigationHandler.bind(null, "/search")}>
          <FaSearch className={classes.drawerIcon} size={iconSize} />
          <ListItemText primary="search" />
        </ListItem> */}
        </List>

        <Divider />
        <List>
          {!currentUser && (
            <>
              <ListItem
                onClick={navigationHandler.bind(null, "/signup")}
                button
                key="Sign Up"
              >
                <ListItemText primary="Sign Up" />
              </ListItem>
              <ListItem
                onClick={navigationHandler.bind(null, "/login")}
                button
                key="Log In"
              >
                <ListItemText primary="Log In" />
              </ListItem>
            </>
          )}
          {currentUser && (
            <>
              <ListItem onClick={logoutHandler} button key="Log Out">
                <ListItemText primary="Log Out" />
              </ListItem>
            </>
          )}
          <Divider />
          <ListItem
            onClick={navigationHandler.bind(null, "/about")}
            button
            key="About"
          >
            <ListItemText primary="About" />
          </ListItem>
        </List>
      </Drawer>

    </>
  );
}
