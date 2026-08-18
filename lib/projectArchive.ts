import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { FixtureFace, ProjectData, WallSide } from "@/lib/types";

const WALL_SIDES: WallSide[] = ["back", "left", "right"];
const FIXTURE_FACES: FixtureFace[] = ["front", "left", "right", "back"];

function decodeDataUrl(value: string) {
  const comma = value.indexOf(",");
  if (!value.startsWith("data:") || comma < 0) return null;
  const metadata = value.slice(5, comma);
  const mimeType = metadata.split(";")[0] || "application/octet-stream";
  const body = value.slice(comma + 1);
  const bytes = metadata.includes(";base64")
    ? Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
    : strToU8(decodeURIComponent(body));
  return { mimeType, bytes };
}

function encodeDataUrl(bytes: Uint8Array, mimeType: string) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function extensionForMime(mimeType: string, fallback: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gltf-binary") || mimeType.includes("octet-stream")) return "glb";
  return fallback;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

export function createPortableProject(project: ProjectData) {
  const portable = structuredClone(project);
  portable.assets = {};
  const files: Record<string, Uint8Array> = {};

  function store(value: string | undefined, basePath: string, fallbackExtension: string) {
    if (!value) return value;
    const decoded = decodeDataUrl(value);
    if (!decoded) return value;
    const path = `${basePath}.${extensionForMime(decoded.mimeType, fallbackExtension)}`;
    files[path] = decoded.bytes;
    portable.assets![path] = { mimeType: decoded.mimeType };
    return `asset://${path}`;
  }

  portable.booth.floorImage = store(portable.booth.floorImage, "assets/booth/floor", "png");
  WALL_SIDES.forEach((side) => {
    portable.booth.wallImages[side] = store(
      portable.booth.wallImages[side],
      `assets/booth/${side}-wall`,
      "png",
    );
  });

  portable.fixtures.forEach((fixture) => {
    const root = `assets/fixtures/${safeSegment(fixture.id)}`;
    fixture.modelUrl = store(fixture.modelUrl, `${root}/model`, "glb");
    FIXTURE_FACES.forEach((face) => {
      const settings = fixture.faceTextures?.[face];
      if (settings) settings.image = store(settings.image, `${root}/${face}`, "png");
    });
  });

  files["project.json"] = strToU8(JSON.stringify(portable, null, 2));
  const zipped = zipSync(files, { level: 6 });
  return new Blob([new Uint8Array(zipped).buffer], { type: "application/vnd.pawplan+zip" });
}

type LegacyProject = Omit<ProjectData, "version" | "booth" | "fixtures"> & {
  version?: number;
  booth: ProjectData["booth"] & { wallImage?: string; wallImages?: ProjectData["booth"]["wallImages"] };
  fixtures: Array<ProjectData["fixtures"][number] & { source?: string }>;
};

function normalizeProject(input: LegacyProject | ProjectData): ProjectData {
  if (!input?.booth || !Array.isArray(input.fixtures)) throw new Error("프로젝트 데이터가 올바르지 않습니다.");
  const legacyWallImage = "wallImage" in input.booth ? input.booth.wallImage : undefined;
  const wallImages = input.booth.wallImages ?? {
    back: legacyWallImage,
    left: legacyWallImage,
    right: legacyWallImage,
  };
  return {
    ...input,
    version: 2,
    booth: { ...input.booth, wallImages },
    fixtures: input.fixtures.map((fixture) => ({
      ...fixture,
      source: fixture.source === "photo" || fixture.source === "upload" ? fixture.source : "primitive",
    })),
  } as ProjectData;
}

function restoreAssets(project: ProjectData, files: Record<string, Uint8Array>) {
  const manifest = project.assets ?? {};
  function restore(value?: string) {
    if (!value?.startsWith("asset://")) return value;
    const path = value.slice("asset://".length);
    const bytes = files[path];
    if (!bytes) throw new Error(`프로젝트 자산이 누락되었습니다: ${path}`);
    return encodeDataUrl(bytes, manifest[path]?.mimeType ?? "application/octet-stream");
  }

  project.booth.floorImage = restore(project.booth.floorImage);
  WALL_SIDES.forEach((side) => {
    project.booth.wallImages[side] = restore(project.booth.wallImages[side]);
  });
  project.fixtures.forEach((fixture) => {
    fixture.modelUrl = restore(fixture.modelUrl);
    FIXTURE_FACES.forEach((face) => {
      const settings = fixture.faceTextures?.[face];
      if (settings) settings.image = restore(settings.image);
    });
  });
  delete project.assets;
  return project;
}

export async function readPortableProject(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (file.name.toLowerCase().endsWith(".json")) {
    return normalizeProject(JSON.parse(strFromU8(bytes)) as LegacyProject);
  }

  const files = unzipSync(bytes);
  const projectFile = files["project.json"];
  if (!projectFile) throw new Error("project.json이 없는 PawPlan 파일입니다.");
  const project = normalizeProject(JSON.parse(strFromU8(projectFile)) as ProjectData);
  return restoreAssets(project, files);
}

export function downloadPortableProject(project: ProjectData, filename: string) {
  const blob = createPortableProject(project);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeSegment(filename)}.pawplan`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
