import type { ProjectData } from "@/lib/types";

type WorkerResponse =
  | { id: string; ok: true; buffer?: ArrayBuffer; project?: ProjectData }
  | { id: string; ok: false; error: string };

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

function runArchiveWorker(
  payload: { type: "create"; project: ProjectData } | { type: "read"; buffer: ArrayBuffer; fileName: string },
) {
  return new Promise<WorkerResponse>((resolve, reject) => {
    const worker = new Worker(new URL("../workers/projectArchive.worker.ts", import.meta.url), { type: "module" });
    const id = crypto.randomUUID();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "프로젝트 Worker를 시작하지 못했습니다."));
    };
    if (payload.type === "read") worker.postMessage({ id, ...payload }, [payload.buffer]);
    else worker.postMessage({ id, ...payload });
  });
}

export async function readPortableProject(file: File) {
  const buffer = await file.arrayBuffer();
  const response = await runArchiveWorker({ type: "read", buffer, fileName: file.name });
  if (!response.ok) throw new Error(response.error);
  if (!response.project) throw new Error("프로젝트 데이터가 비어 있습니다.");
  return response.project;
}

export async function downloadPortableProject(project: ProjectData, filename: string) {
  const response = await runArchiveWorker({ type: "create", project });
  if (!response.ok) throw new Error(response.error);
  if (!response.buffer) throw new Error("프로젝트 파일을 만들지 못했습니다.");
  const blob = new Blob([response.buffer], { type: "application/vnd.pawplan+zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeSegment(filename)}.pawplan`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
