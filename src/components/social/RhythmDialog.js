import { useState } from "react";
import Link from "next/link";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import { DIFFICULTIES } from "../../lib/social/config";
import { socialRequest } from "./api";
import styles from "./social.module.css";

export default function RhythmDialog({ rhythm, composition, onClose, onSaved }) {
  const source = rhythm || composition || {};
  const [values,setValues] = useState({ name: source.name || "", description: source.description || "", tags: (source.tags || []).join(", "), difficulty: source.difficulty || "beginner", visibility: source.visibility || "private" });
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const [saveMutations,setSaveMutations] = useState(false), [confirmDelete,setConfirmDelete] = useState(false);
  function update(key) { return (event) => setValues((v) => ({ ...v, [key]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await socialRequest(rhythm ? `rhythms/${rhythm.id}` : "rhythms", { method: rhythm ? "PATCH" : "POST", body: {
        ...values, ...(rhythm ? {} : { score: composition.score, tempo: composition.tempo, mutations: saveMutations ? composition.mutations?.slice(0,1) || [] : [] }),
      } });
      onSaved(result.rhythm);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try { await socialRequest(`rhythms/${rhythm.id}`,{ method: "DELETE" }); onSaved(null); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="rhythm-dialog-title">
    <DialogTitle id="rhythm-dialog-title">{rhythm ? "Edit your rhythm" : "Save to your profile"}</DialogTitle>
    <DialogContent><form onSubmit={submit} className={styles.form}>
      <label>Title<input required maxLength={100} autoFocus value={values.name} onChange={update("name")} placeholder="Give this rhythm a name" /></label>
      <label>Practice notes<textarea maxLength={1000} rows={3} value={values.description} onChange={update("description")} placeholder="What should a drummer listen for or work on?" /></label>
      <div className={styles.formRow}><label>Level<select value={values.difficulty} onChange={update("difficulty")}>{DIFFICULTIES.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Visibility<select value={values.visibility} onChange={update("visibility")}><option value="private">Private — only you</option><option value="public">Public — community &amp; profile</option></select></label></div>
      <label>Tags<input value={values.tags} onChange={update("tags")} maxLength={198} placeholder="triplets, coordination, jazz" /><small>Separate up to eight tags with commas.</small></label>
      {values.visibility === "public" ? <p className={styles.hint}>Anyone can find and save this rhythm. You need a <Link href="/profile" target="_blank" rel="noreferrer">public profile</Link> to publish.</p> : <p className={styles.hint}>Only you can see this rhythm in your profile. It stays saved to your account across devices.</p>}
      {!rhythm && composition?.mutations?.length > 0 && <label className={styles.check}><input type="checkbox" checked={saveMutations} onChange={(e) => setSaveMutations(e.target.checked)} />Keep dynamic rhythm settings</label>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.formActions}><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Saving..." : values.visibility === "public" ? "Save & publish" : "Save privately"}</button></div>
    </form>
      {rhythm && <div className={styles.deleteArea}>{confirmDelete ? <><p>Delete this rhythm? It will also leave other drummers' saved collections.</p><button disabled={busy} className={styles.danger} onClick={remove}>Delete permanently</button><button disabled={busy} onClick={() => setConfirmDelete(false)}>Keep rhythm</button></> : <button disabled={busy} className={styles.danger} onClick={() => setConfirmDelete(true)}>Delete rhythm</button>}</div>}
    </DialogContent>
  </Dialog>;
}
