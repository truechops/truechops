import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import { socialRequest } from "./api";
import { MEDIA_TYPES, mediaFileInfo } from "../../lib/social/media-config";
import { uploadRecording } from "./media-upload";
import styles from "./social.module.css";

export default function RhythmDialog({ rhythm, composition, onClose, onSaved }) {
  const source = rhythm || composition || {};
  const [values,setValues] = useState({ name: source.name || "", tags: (source.tags || []).join(", "), visibility: source.visibility || "private" });
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const [saveMutations,setSaveMutations] = useState(false), [confirmDelete,setConfirmDelete] = useState(false);
  const [attached,setAttached] = useState(source.media || []);
  const [files,setFiles] = useState({}), [removed,setRemoved] = useState([]), [progress,setProgress] = useState(null);
  const draft = useRef(rhythm), tasks = useRef({}), controller = useRef(null);
  useEffect(() => () => controller.current?.abort(),[]);
  function chooseFile(kind,event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      mediaFileInfo(kind,file); setFiles((current) => ({...current,[kind]:file})); delete tasks.current[kind]; setError("");
      const existing = attached.find((item) => item.kind === kind);
      if (existing) setRemoved((current) => current.filter((id) => id !== existing.id));
    }
    catch (failure) { setError(failure.message); event.target.value = ""; }
  }
  function update(key) { return (event) => setValues((v) => ({ ...v, [key]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      const creation = { score:composition?.score, tempo:composition?.tempo, mutations:saveMutations ? composition?.mutations?.slice(0,1) || [] : [] };
      const selected = Object.entries(files);
      // Media always belongs to a saved rhythm; new compositions remain private
      // until all files are uploaded and the final publication succeeds.
      if (!draft.current && selected.length) {
        const saved = await socialRequest("rhythms",{method:"POST",body:{...values,...creation,visibility:"private"},signal});
        draft.current = saved.rhythm;
      }
      for (const [kind,file] of selected) {
        const task = tasks.current[kind] || (tasks.current[kind] = {});
        setProgress({kind,percent:0});
        const uploaded = await uploadRecording(draft.current.id,kind,file,task,{signal,onProgress:(percent) => setProgress({kind,percent})});
        setAttached((current) => [...current.filter((item) => item.kind !== kind),uploaded.media]);
        setFiles((current) => { const next = {...current}; delete next[kind]; return next; });
      }
      if (draft.current) for (const id of removed) await socialRequest(`rhythms/${draft.current.id}/media/${id}`,{method:"DELETE",signal});
      setRemoved([]);
      const result = await socialRequest(draft.current ? `rhythms/${draft.current.id}` : "rhythms", { method:draft.current ? "PATCH" : "POST", signal,
        body:{...values,...(draft.current ? {} : creation)},
      });
      onSaved(result.rhythm);
    } catch (failure) {
      setError(signal.aborted ? "Upload stopped. Your rhythm is saved; save again to retry." : failure.message);
    } finally { setBusy(false); setProgress(null); }
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
      <label>Visibility<select value={values.visibility} onChange={update("visibility")}><option value="private">Private — only you</option><option value="public">Public — community &amp; profile</option></select></label>
      <label>Tags<input value={values.tags} onChange={update("tags")} maxLength={198} placeholder="triplets, coordination, jazz" /><small>Separate up to eight tags with commas.</small></label>
      {values.visibility === "public" ? <p className={styles.hint}>Anyone can find and save this rhythm. You need a <Link href="/profile" target="_blank" rel="noreferrer">public profile</Link> to publish.</p> : <p className={styles.hint}>Only you can see this rhythm in your profile. It stays saved to your account across devices.</p>}
      {!rhythm && composition?.mutations?.length > 0 && <label className={styles.check}><input type="checkbox" checked={saveMutations} onChange={(e) => setSaveMutations(e.target.checked)} />Keep dynamic rhythm settings</label>}
      <fieldset className={styles.mediaFields} disabled={busy}>
        <legend>Recordings <span>optional</span></legend>
        <p>Add a demonstration or a recording to practice along with.</p>
        {Object.entries(MEDIA_TYPES).map(([kind,spec]) => {
          const existing = attached.find((item) => item.kind === kind);
          return <div className={styles.mediaField} key={kind}>
            <label>{spec.label}<input type="file" accept={spec.accept} aria-label={`Upload ${kind}`} onChange={(event) => chooseFile(kind,event)} />
              <small>{spec.accept.replaceAll(".","").toUpperCase()} &middot; up to {spec.maxBytes/1024/1024} MB</small></label>
            {files[kind] ? <div><span>{files[kind].name}</span><button type="button" onClick={() => setFiles((current) => {const next = {...current};delete next[kind];return next;})}>Clear file</button></div> :
              existing && <div><span>{existing.name}{removed.includes(existing.id) ? " (will remove)" : ` (${existing.status})`}</span>
                <button type="button" onClick={() => setRemoved((current) => current.includes(existing.id) ? current.filter((id) => id !== existing.id) : [...current,existing.id])}>{removed.includes(existing.id) ? "Keep recording" : `Remove ${kind}`}</button></div>}
          </div>;
        })}
      </fieldset>
      {progress && <div className={styles.uploadProgress} role="status"><span>Uploading {progress.kind}: {progress.percent}%</span><progress max="100" value={progress.percent} />
        <button type="button" onClick={() => controller.current?.abort()}>Stop upload</button></div>}
      {draft.current && !rhythm && error && <p className={styles.hint}>Your rhythm is saved privately in your profile. Retry here, or add recordings later from Edit details.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.formActions}><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Saving..." : values.visibility === "public" ? "Save & publish" : "Save privately"}</button></div>
    </form>
      {rhythm && <div className={styles.deleteArea}>{confirmDelete ? <><p>Delete this rhythm? It will also leave other drummers&apos; saved collections.</p><button disabled={busy} className={styles.danger} onClick={remove}>Delete permanently</button><button disabled={busy} onClick={() => setConfirmDelete(false)}>Keep rhythm</button></> : <button disabled={busy} className={styles.danger} onClick={() => setConfirmDelete(true)}>Delete rhythm</button>}</div>}
    </DialogContent>
  </Dialog>;
}
