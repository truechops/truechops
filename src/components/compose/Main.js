import Buttons from "./Buttons";
import { makeStyles } from "@material-ui/core/styles";
import { useState } from "react";
import Score from "./Score";
import ErrorBoundary from "../error/ErrorBoundary";
import $ from 'jquery';

export default function Main(isDynamicRhythm) {
  const [selectedTab, setSelectedTab] = useState(1);
  const [tabPanelHidden, setTabPanelHidden] = useState(false);

  const calculateButtonsHeight = (theme, isMobile) => {
    let buttonsHeight = 0;
    const toolbarHeight = theme.mixins.toolbar.minHeight;
    const tabsHeight = theme.overrides.MuiTab.root.minHeight;
    const chipHeight = theme.overrides.MuiChip.root.minHeight;
    const rowBottomMargin = theme.compose.buttons.row.marginBottom;
    const spacing = theme.spacing();
    const buttonsContainerPadding = theme.compose.buttons.container.padding;

    /*If the tab panel is hidden, the buttons are hidden. So, button height = 0.
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
      top: theme.mixins.toolbar.minHeight,
      left: "50%",
      transform: "translateX(-50%)",
    },
    root: {
      paddingTop: theme.mixins.toolbar.minHeight,
      flexDirection: "column",
      display: "flex",
      height: "100%",
    },
    score: {
      position: "fixed",
      [theme.breakpoints.down("xs")]: {
        height: `calc(100% - ${calculateButtonsHeight(theme, true)}px)`,
        top: calculateButtonsHeight(theme, true),
      },
      [theme.breakpoints.up("sm")]: {
        height: `calc(100% - ${calculateButtonsHeight(theme, false)}px)`,
        top: calculateButtonsHeight(theme, false),
      },
      width: '100%',
      overflow: "auto",
      flex: 1,
    },
  }));

  const classes = useTabStyles();
  return (
    <main>
      <div className={classes.root}>
        <div className={classes.buttons}>
          <ErrorBoundary component="compose buttons">
            <Buttons selectedTab={selectedTab} onTabSelected={onTabSelected} />
          </ErrorBoundary>
        </div>
        <div id="score-root" className={classes.score}>
          <ErrorBoundary component="compose">
            <Score selectedTab={selectedTab} tabPanelHidden={tabPanelHidden} isDynamicRhythm={isDynamicRhythm}/>
          </ErrorBoundary>
        </div>
      </div>
    </main>
  );
}
