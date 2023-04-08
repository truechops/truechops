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
      if(selectedTab == 3) {
        //JARED_TODO: cleanup magic constant
        buttonsHeight = theme.mixins.toolbar.minHeight - 10;
      } else {
        const paddingHeight = 2 * spacing * buttonsContainerPadding;
              //The first tab is the notes tab
              const numChips = selectedTab === 1 ? (isMobile ? 4 : 2) : 1;
              
              //JARED_TODO: cleanup magic constant
              buttonsHeight = paddingHeight + numChips * (chipHeight + rowBottomMargin) - 32;
      }
    } else {
      buttonsHeight = theme.compose.score.tabsHiddenTopPadding
      
      //JARED_TODO: magic constant
      buttonsHeight = buttonsHeight - (selectedTab === 3 ? 10 : 32)
    }

    return buttonsHeight;
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
      bottom: 0,
    },
    root: {
      flexDirection: "column",
      display: "flex",
      height: "100%"
    },
    score: {
      width: '100%',
      overflow: "auto",
      flex: 1,
      zIndex: 1
    },
    vexflowWrapper: {
      [theme.breakpoints.down("sm")]: {
        height: `calc(${window.innerHeight}px - ${calculateButtonsHeight(theme, true)}px - ${3 * theme.mixins.toolbar.minHeight}px - 12px)`,
      },
      [theme.breakpoints.up("sm")]: {
        height: `calc(${window.innerHeight}px - ${calculateButtonsHeight(theme, false)}px - ${3 * theme.mixins.toolbar.minHeight}px - 12px)`,
      },
    }
,    vexflow: {
      [theme.breakpoints.down("sm")]: {
        height: `100%`,
      },
      [theme.breakpoints.up("sm")]: {
        height: `100%`,
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
                   isDynamicRhythm={isDynamicRhythm} vexflowClass={classes.vexflow} vexflowWrapperClass={classes.vexflowWrapper}/>
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
