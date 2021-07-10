import { useRouter } from "next/router";
import { useSelector, useDispatch } from "react-redux";
import { sideNavActions } from "../../store/navigation";
import { logout } from "../../store/realm-app";

import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Drawer from "@material-ui/core/Drawer";
import List from "@material-ui/core/List";
import Divider from "@material-ui/core/Divider";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";

import { FaDrum, FaUsers, FaTools, FaSearch, FaUserTie } from "react-icons/fa";
import { ImBooks } from "react-icons/im";

export default function Navigation() {
  const drawerWidth = 256;

  const useStyles = makeStyles((theme) => ({
    drawer: {
      width: drawerWidth
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
  const sideNavOpen = useSelector((state) => state.nav.sideNavOpen);
  const { setNavOpen } = sideNavActions;
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
        <ListItem
          button
          key="compose"
          onClick={navigationHandler.bind(null, "/")}
        >
          <FaDrum className={classes.drawerIcon} size={iconSize} />
          <ListItemText primary="compose" />
        </ListItem>
        <ListItem
          button
          key="my library"
          onClick={navigationHandler.bind(null, "/library")}
        >
          <ImBooks className={classes.drawerIcon} size={iconSize} />
          <ListItemText primary="my libary" />
        </ListItem>
        {/* <ListItem
          onClick={navigationHandler.bind(null, "/discover")}
          button
          key="discover"
        >
          <FaUsers className={classes.drawerIcon} size={iconSize} />
          <ListItemText primary="discover" />
        </ListItem> */}
        <ListItem button key="mods" onClick={navigationHandler.bind(null, "/mods")}>
          <FaTools className={classes.drawerIcon} size={iconSize} />
          <ListItemText primary="mods" />
        </ListItem>
        {/* <ListItem button key="search" onClick={navigationHandler.bind(null, "/search")}>
          <FaSearch className={classes.drawerIcon} size={iconSize} />
          <ListItemText primary="search" />
        </ListItem> */}
      </List>
      {!currentUser && (
        <>
          <Divider />
          <List>
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
          </List>
        </>
      )}
      {currentUser && (
        <>
          <Divider />
          <List>
            <ListItem
              onClick={navigationHandler.bind(null, "/profile")}
              button
              key="Profile"
            >
              <FaUserTie className={classes.drawerIcon} size={iconSize} />
              <ListItemText primary="Profile" />
            </ListItem>
            <ListItem onClick={logoutHandler} button key="Log Out">
              <ListItemText primary="Log Out" />
            </ListItem>
          </List>
        </>
      )}
    </Drawer>
  );
}
