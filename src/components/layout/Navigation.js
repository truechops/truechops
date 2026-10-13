import { useRouter } from "next/router";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { appActions } from "../../store/app";
import { logout } from "../../store/realm-app";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import useMediaQuery from "@mui/material/useMediaQuery";
import { FiMusic, FiActivity, FiLayers, FiGrid, FiUsers, FiUser, FiLogIn, FiUserPlus, FiLogOut, FiBookOpen, FiInfo } from "react-icons/fi";
import { communityRoutes } from "./community-layout";
import styles from "./community.module.css";

export default function Navigation() {
  const router = useRouter(), dispatch = useDispatch();
  const currentUser = useSelector((state) => state.realm.currentUser);
  const sideNavOpen = useSelector((state) => state.app.sideNavOpen);
  const desktop = useMediaQuery("(min-width:1100px)");
  const permanent = desktop && communityRoutes.includes(router.pathname);
  const close = () => dispatch(appActions.setNavOpen(false));
  function item(label,url,Icon) {
    const selected = router.pathname === url || url === "/discover" && ["/search","/rhythms/[id]"].includes(router.pathname) || url === "/profile" && ["/library","/u/[handle]"].includes(router.pathname);
    return <ListItem disablePadding key={label}><ListItemButton component={Link} href={url} onClick={close} selected={selected} aria-current={selected ? "page" : undefined}>
      <ListItemIcon><Icon aria-hidden="true" /></ListItemIcon><ListItemText primary={label} />
    </ListItemButton></ListItem>;
  }
  return <Drawer variant={permanent ? "permanent" : "temporary"} open={permanent || sideNavOpen} onClose={close}
    classes={{ paper: `${styles.sidebar} ${permanent ? styles.permanent : ""}` }}>
    <nav aria-label="Site navigation">
      <List aria-label="Practice tools">
        {item("Score","/",FiMusic)}{item("Drills","/exercises",FiActivity)}{item("Rudiments","/rudiments",FiLayers)}{item("BYOS","/byos",FiGrid)}
      </List>
      <Divider />
      <List>{item("Community — Rhythms & People","/discover",FiUsers)}{item("My Profile & Rhythms","/profile",FiUser)}</List>
      <Divider />
      <List>
        {!currentUser ? <>{item("Sign Up","/signup",FiUserPlus)}{item("Log In","/login",FiLogIn)}</> :
          <ListItem disablePadding><ListItemButton onClick={() => { dispatch(logout()); close(); router.push("/"); }}><ListItemIcon><FiLogOut aria-hidden="true" /></ListItemIcon><ListItemText primary="Log Out" /></ListItemButton></ListItem>}
        <Divider />
        {item("My Books & Saved Practice","/account/books",FiBookOpen)}{item("About","/about",FiInfo)}
      </List>
    </nav>
  </Drawer>;
}
