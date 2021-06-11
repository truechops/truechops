import { cloneElement, useState } from "react";
import AppBar from "@material-ui/core/AppBar";
import useScrollTrigger from "@material-ui/core/useScrollTrigger";
import { makeStyles } from "@material-ui/styles";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Link from "../Link";
import { useRouter } from "next/router";
import Avatar from "@material-ui/core/Avatar";
import algoliasearch from "algoliasearch/lite";
import { useSelector } from "react-redux";

const searchClient = algoliasearch(
  "7VD37OIZBX",
  "075e3727b35d845338b30a28b5a54562"
);

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

const useStyles = makeStyles((theme) => ({
  toolbarMargin: {
    ...theme.mixins.toolbar,
    marginBottom: "3em",
  },
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
  },
  logo: {
    height: "7em",
  },
  tabContainer: {
    flewGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
  iconTab: {
    opacity: 1,
  },
  contentTabsContainer: {
    float: "left",
  },
  profileTabsContainer: {
    clear: "left",
    float: "right",
  },
  rightAlign: {
    marginLeft: "auto",
  },
  button: {
    ...theme.typography.estimate,
    borderRadius: "50px",
    marginRight: "25px",
    marginLeft: "50px",
    height: "45px",
  },
}));

export default function Header(props) {
  const classes = useStyles();
  const [tabIndex, setTabIndex] = useState(0);
  const [isContentTabSelected, setContentTabSelected] = useState(0);
  const router = useRouter();
  const currentUser = useSelector(state => state.realm.currentUser);

  const onChangeHandler = (e, tabIndex) => {
    setTabIndex(tabIndex);
  };

  useState(() => {
    if (router.pathname === "/library") {
      setTabIndex(1);
    } else if (router.pathname === "/discover") {
      setTabIndex(2);
    } else if (router.pathname === "/signup") {
      setTabIndex(3);
    } else if (router.pathname === "/login") {
      setTabIndex(4);
    }
  }, [router]);

  /**
   * disableGutters - gets rid of padding
   */
  return (
    <>
      <ElevationScroll>
        <div className={classes.grow}>
          <AppBar position="fixed" color="secondary">
            <Tabs
              value={tabIndex}
              className={classes.tabContainer}
              onChange={onChangeHandler}
            >
              <Tab
                disableRipple
                component={Link}
                className={classes.iconTab}
                href="/"
                icon={<Avatar alt="company logo" src="/assets/logo.png" />}
              />

              <Tab
                disableRipple
                component={Link}
                label="library"
                href="/library"
              />
              <Tab
                disableRipple
                label="Discover"
                component={Link}
                href="/discover"
              />
              {/* <InstantSearch indexName="rhythms" searchClient={searchClient}>
                <SearchBox />
                <Hits
                  hitComponent={({ hit }) => (
                    <p>
                      {hit.firstname} {hit.lastname}
                    </p>
                  )}
                />
              </InstantSearch> */}
              {!currentUser && (
                <>
                  <Tab
                    disableRipple
                    className={classes.rightAlign}
                    label="Sign Up"
                    component={Link}
                    href="/signup"
                  />
                  <Tab
                    disableRipple
                    label="Log In"
                    component={Link}
                    href="/login"
                  />
                </>
              )}
            </Tabs>
          </AppBar>
        </div>
      </ElevationScroll>
      <div className={classes.toolbarMargin}></div>
    </>
  );
}
