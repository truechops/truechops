import { Upload } from "tus-js-client";
import { socialRequest } from "./api";
import { mediaFileInfo } from "../../lib/social/media-config";

// A task is retained by the form for retries. It never resumes into a different
// recording, and upload signatures/API responses aren't saved in localStorage.
export async function uploadRecording(rhythmId, kind, file, task, { signal, onProgress }) {
  const info = mediaFileInfo(kind,file), base = `rhythms/${rhythmId}/media`;
  if (signal.aborted) throw new Error("Upload stopped. Your rhythm is saved; you can retry.");
  if (!task.transferred && (!task.upload || task.expires <= Date.now())) {
    const result = await socialRequest(base,{method:"POST",body:{...info,...(task.id ? {uploadId:task.id} : {})},signal});
    task.id = result.media.id; task.upload = result.upload;
    task.expires = Number(result.upload.headers.AuthorizationExpire)*1000;
  }
  if (!task.transferred) await new Promise((resolve,reject) => {
    let upload;
    const finish = (error) => { signal.removeEventListener("abort",abort); error ? reject(error) : resolve(); };
    const abort = () => { upload?.abort(); finish(new Error("Upload stopped. Your rhythm is saved; you can retry.")); };
    upload = new Upload(file,{
      endpoint:task.upload.endpoint, headers:task.upload.headers, chunkSize:8*1024*1024,
      uploadUrl:task.url || undefined, storeFingerprintForResuming:false,
      retryDelays:[0,1000,3000,5000,10000], metadata:{filetype:info.mime,title:info.name},
      onProgress:(sent,total) => { task.url = upload.url; onProgress(Math.round(sent/total*100)); },
      onAfterResponse:() => { task.url = upload.url; },
      onShouldRetry:(error) => {
        const status = error.originalResponse?.getStatus();
        return !status || status >= 500 || [409,423,429].includes(status);
      },
      onError:() => finish(new Error("Upload interrupted. Check your connection and save again to retry.")),
      onSuccess:() => { task.transferred = true; finish(); },
    });
    signal.addEventListener("abort",abort,{once:true});
    if (signal.aborted) abort(); else upload.start();
  });
  return socialRequest(`${base}/${task.id}/complete`,{method:"POST",signal});
}
