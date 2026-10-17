import { useState } from "react";
import { FiEdit2, FiShuffle } from "react-icons/fi";
import EditTools, { EditTabs } from "./EditTools";
import MutateTools from "./MutateTools";
import TopToolbar from "./TopToolbar";
import { useScoreTools } from "./score-tools";
import styles from "./score-workspace.module.css";

// initialTab predates the modes: 3 was the Mutate tab.
const MUTATE_TAB = 3;

export default function ScoreToolbar({ initialTab = 1 }) {
  const [mode, setMode] = useState(initialTab === MUTATE_TAB ? "mutate" : "edit");
  const [tab, setTab] = useState(initialTab === MUTATE_TAB ? 1 : initialTab);
  const { notice } = useScoreTools();

  return <section className={styles.toolbar} data-mode={mode} aria-label="Score tools">
    <div className={styles.toolbarGrid}>
      <div className={styles.modes} role="group" aria-label="Mode">
        <button type="button" className={styles.mode} aria-pressed={mode === "edit"} onClick={() => setMode("edit")}><FiEdit2 aria-hidden="true" />Edit</button>
        <button type="button" className={styles.mode} aria-pressed={mode === "mutate"} onClick={() => setMode("mutate")}><FiShuffle aria-hidden="true" />Mutate</button>
      </div>
      {mode === "edit" ? <>
        <EditTabs tab={tab} onTabChange={setTab} />
        <EditTools tab={tab} />
      </> : <MutateTools />}
      <TopToolbar />
    </div>
    <span className={styles.notice} role="status">{notice}</span>
  </section>;
}
