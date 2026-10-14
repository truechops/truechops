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
import { FiMusic, FiActivity, FiLayers, FiGrid, FiSearch, FiUser, FiLogIn, FiUserPlus, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import styles from "./community.module.css";

export default function Navigation() {
  const router = useRouter(), dispatch = useDispatch();
  const currentUser = useSelector((state) => state.realm.currentUser);
  const sideNavOpen = useSelector((state) => state.app.sideNavOpen);
  const desktop = useMediaQuery("(min-width:1100px)");
  const permanent = desktop;
  const close = () => dispatch(appActions.setNavOpen(false));
  function item(label,url,Icon) {
    const selected = router.pathname === url || url === "/discover" && ["/search","/rhythms/[id]"].includes(router.pathname) || url === "/profile" && ["/library","/u/[handle]","/account/books"].includes(router.pathname);
    return <ListItem disablePadding key={label}><ListItemButton component={Link} href={url} onClick={close} selected={selected} aria-label={label} aria-current={selected ? "page" : undefined}>
      <ListItemIcon><Icon aria-hidden="true" /></ListItemIcon><ListItemText primary={label} />
    </ListItemButton></ListItem>;
  }
  return <>
    <button className={styles.menuButton} aria-label="open drawer" aria-expanded={sideNavOpen} aria-controls={sideNavOpen ? "site-navigation" : undefined} onClick={() => dispatch(appActions.setNavOpen(true))}><FiMenu aria-hidden="true" /></button>
    <Drawer variant={permanent ? "permanent" : "temporary"} open={permanent || sideNavOpen} onClose={close}
    classes={{ paper: `${styles.sidebar} ${permanent ? styles.permanent : ""}` }}>
    <div className={styles.sidebarTop}><Link href="/discover" onClick={close} className={styles.brand} aria-label="TrueChops"><span className={styles.brandMark} aria-hidden="true" /><span className={styles.brandName}>True<span>Chops</span></span></Link>
      {!permanent && <button className={styles.closeMenu} onClick={close} aria-label="Close navigation"><FiX aria-hidden="true" /></button>}
    </div>
    <nav id="site-navigation" aria-label="Site navigation">
      <List aria-label="Practice tools">
        {item("Score","/",FiMusic)}{item("Drills","/exercises",FiActivity)}{item("Rudiments","/rudiments",FiLayers)}{item("BYOS","/byos",FiGrid)}
      </List>
      <Divider />
      <List>{item("Search","/discover",FiSearch)}{item("Profile","/profile",FiUser)}</List>
      <Divider />
      <List>
        {!currentUser ? <>{item("Sign Up","/signup",FiUserPlus)}{item("Log In","/login",FiLogIn)}</> :
          <ListItem disablePadding><ListItemButton aria-label="Log Out" onClick={() => { dispatch(logout()); close(); router.push("/"); }}><ListItemIcon><FiLogOut aria-hidden="true" /></ListItemIcon><ListItemText primary="Log Out" /></ListItemButton></ListItem>}
      </List>
    </nav>
  </Drawer></>;
}
