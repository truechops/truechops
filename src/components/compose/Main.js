import Buttons from "./Buttons";
import { makeStyles } from "@material-ui/core/styles";
import { useState } from "react";
import Score from "./Score";
import ErrorBoundary from "../error/ErrorBoundary";
import $ from 'jquery';
import { useSelector } from "react-redux";

import dynamic from "next/dynamic";

//Each page has its own top toolbar. Render it dynamically based on which page you are on.
const DynamicComposeTopToolbar = dynamic(() => import("../compose/TopToolbar"));

export default function Main(isDynamicRhythm) {
  const [selectedTab, setSelectedTab] = useState(1);
  const [tabPanelHidden, setTabPanelHidden] = useState(false);
  const score = useSelector((state) => state.score.present.score);

  const calculateButtonsHeight = (theme, isMobile) => {
    let buttonsHeight = 0;
    const toolbarHeight = theme.mixins.toolbar.minHeight;
    const tabsHeight = theme.overrides.MuiTab.root.minHeight;
    const chipHeight = theme.overrides.MuiChip.root.minHeight;
    const rowBottomMargin = theme.compose.buttons.row.marginBottom;
    const spacing = theme.spacing();
    const buttonsContainerPadding = theme.compose.buttons.container.padding;

    /* If the tab panel is hidden, the buttons are hidden. So, button height = 0.
     * In this case, the score will be right below the tabs, which is right
     * below the toolbar.
     */
    if (!tabPanelHidden) {
      const paddingHeight = 2 * spacing * buttonsContainerPadding;

      //The first tab is the notes tab
      const numChips = selectedTab === 1 ? (isMobile ? 4 : 2) : 1;
      buttonsHeight = paddingHeight + numChips * (chipHeight + rowBottomMargin);
    } else {
      buttonsHeight += theme.compose.score.tabsHiddenTopPadding;
    }

    return toolbarHeight + tabsHeight + buttonsHeight;
  };

  const onTabSelected = (event, newValue) => {
    if (newValue === selectedTab) {
      $("#composeButtonsTabPanel").toggle();
      setTabPanelHidden((hidden) => !hidden);
    } else {
      $("#composeButtonsTabPanel").show();
      setTabPanelHidden(false);
      setSelectedTab(newValue);
    }
  };

  const useTabStyles = makeStyles((theme) => ({
    buttons: {
      position: "fixed",
      left: "51%",
      transform: "translateX(-50%)",
      bottom: theme.overrides.MuiTab.root.minHeight,
    },
    root: {
      flexDirection: "column",
      display: "flex",
      height: "100%"
    },
    score: {

      // JARED_TODO: is this even used
      [theme.breakpoints.down("xs")]: {
        height: `calc(100vh - ${calculateButtonsHeight(theme, true)}px - ${2 * theme.mixins.toolbar.minHeight}px - 8px)`,
      },
      [theme.breakpoints.up("sm")]: {
        height: `calc(100vh - ${calculateButtonsHeight(theme, false)}px - ${2 * theme.mixins.toolbar.minHeight}px - 8px)`,
      },
      width: '100%',
      overflow: "auto",
      flex: 1,
    },
    vexflow: {
      [theme.breakpoints.down("xs")]: {
        height: `calc(100vh - ${calculateButtonsHeight(theme, true)}px - ${2 * theme.mixins.toolbar.minHeight}px - 8px)`,
      },
      [theme.breakpoints.up("sm")]: {
        height: `calc(100vh - ${calculateButtonsHeight(theme, false)}px - ${2 * theme.mixins.toolbar.minHeight}px - 8px)`,
      }, 
    },
    toolbar: {
      display: 'flex',
      justifyContent: 'center'
    }
  }));

  const classes = useTabStyles();
  return (
    <main>
      <div className={classes.root}>
        <div className={classes.toolbar}>
          <ErrorBoundary component="compose toolbar">
            <DynamicComposeTopToolbar />
          </ErrorBoundary>
        </div>
        <div id="score-root" className={classes.score}>
          <ErrorBoundary component="compose">
            <Score id={"vexflow"} score={score} selectedTab={selectedTab} tabPanelHidden={tabPanelHidden} 
                   isDynamicRhythm={isDynamicRhythm} vexflowClass={classes.vexflow}/>
          </ErrorBoundary>
        </div>
        <div className={classes.buttons}>
          <ErrorBoundary component="compose buttons">
            <Buttons selectedTab={selectedTab} onTabSelected={onTabSelected} />
          </ErrorBoundary>
        </div>
      </div>
    </main>
  );
}
