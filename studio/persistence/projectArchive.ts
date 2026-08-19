import type { HustleProject } from "@/studio/domain/types";

type WorkerResponse =
  | { id: string; ok: true; buffer?: ArrayBuffer; project?: HustleProject }
  | { id: string; ok: false; error: string };

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-").replace(/^-+|-+$/g, "") || "hustle-3d-project";
}

function runWorker(payload: { type: "create"; project: HustleProject } | { type: "read"; buffer: ArrayBuffer }) {
  return new Promise<WorkerResponse>((resolve, reject) => {
    const worker = new Worker(new URL("../../workers/studioArchive.worker.ts", import.meta.url), { type: "module" });
    const id = crypto.randomUUID();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "프로젝트 처리 Worker를 시작하지 못했습니다."));
    };
    if (payload.type === "read") worker.postMessage({ id, ...payload }, [payload.buffer]);
    else worker.postMessage({ id, ...payload });
  });
}

export async function downloadHustleProject(project: HustleProject) {
  const result = await runWorker({ type: "create", project: { ...project, savedAt: new Date().toISOString() } });
  if (!result.ok || !result.buffer) throw new Error(result.ok ? "프로젝트 파일이 비어 있습니다." : result.error);
  const url = URL.createObjectURL(new Blob([result.buffer], { type: "application/vnd.hustle3d+zip" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName(project.name)}.hustle3d`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readHustleProject(file: File) {
  const result = await runWorker({ type: "read", buffer: await file.arrayBuffer() });
  if (!result.ok || !result.project) throw new Error(result.ok ? "프로젝트 데이터가 비어 있습니다." : result.error);
  return result.project;
}
