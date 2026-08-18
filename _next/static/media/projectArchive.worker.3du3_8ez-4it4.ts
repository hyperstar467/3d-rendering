/// <reference lib="webworker" />

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Fixture, FixtureFace, ProjectData, SurfaceTextureSettings, WallSide } from "@/lib/types";
import { DEFAULT_TEXTURE_TRANSFORM } from "@/lib/types";

const WALL_SIDES: WallSide[] = ["back", "left", "right"];
const FIXTURE_FACES: FixtureFace[] = ["front", "left", "right", "back"];

type LegacyBooth = ProjectData["booth"] & {
  floorImage?: string;
  wallImage?: string;
  wallImages?: Partial<Record<WallSide, string>>;
  floorSurface?: SurfaceTextureSettings;
  wallSurfaces?: Partial<Record<WallSide, SurfaceTextureSettings>>;
};

type LegacyProject = Omit<ProjectData, "version" | "booth" | "fixtures"> & {
  version?: number;
  booth: LegacyBooth;
  fixtures: Array<Omit<Fixture, "source"> & { source?: string }>;
};

type WorkerRequest =
  | { id: string; type: "create"; project: ProjectData }
  | { id: string; type: "read"; buffer: ArrayBuffer; fileName: string };

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

function makeSurface(image?: string): SurfaceTextureSettings {
  return { ...DEFAULT_TEXTURE_TRANSFORM, image };
}

function normalizeProject(input: LegacyProject | ProjectData): ProjectData {
  if (!input?.booth || !Array.isArray(input.fixtures)) throw new Error("프로젝트 데이터가 올바르지 않습니다.");
  const booth = input.booth as LegacyBooth;
  const sharedWallImage = booth.wallImage;
  const wallImages = booth.wallImages ?? {};
  return {
    ...input,
    version: 3,
    booth: {
      width: booth.width,
      depth: booth.depth,
      height: booth.height,
      wallMode: booth.wallMode,
      wallColor: booth.wallColor,
      floorColor: booth.floorColor,
      floorMaterial: booth.floorMaterial,
      showGrid: booth.showGrid,
      floorSurface: { ...makeSurface(booth.floorImage), ...booth.floorSurface },
      wallSurfaces: {
        back: { ...makeSurface(wallImages.back ?? sharedWallImage), ...booth.wallSurfaces?.back },
        left: { ...makeSurface(wallImages.left ?? sharedWallImage), ...booth.wallSurfaces?.left },
        right: { ...makeSurface(wallImages.right ?? sharedWallImage), ...booth.wallSurfaces?.right },
      },
    },
    fixtures: input.fixtures.map((fixture) => ({
      ...fixture,
      source: fixture.source === "photo" || fixture.source === "upload" ? fixture.source : "primitive",
      glbMaterialMode: fixture.glbMaterialMode ?? "original",
    })),
  } as ProjectData;
}

function createPortableProject(project: ProjectData) {
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
  portable.booth.floorSurface.image = store(portable.booth.floorSurface.image, "assets/booth/floor", "png");
  WALL_SIDES.forEach((side) => {
    portable.booth.wallSurfaces[side].image = store(portable.booth.wallSurfaces[side].image, `assets/booth/${side}-wall`, "png");
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
  return zipSync(files, { level: 1 });
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
  project.booth.floorSurface.image = restore(project.booth.floorSurface.image);
  WALL_SIDES.forEach((side) => { project.booth.wallSurfaces[side].image = restore(project.booth.wallSurfaces[side].image); });
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

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "create") {
      const bytes = createPortableProject(request.project);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      self.postMessage({ id: request.id, ok: true, buffer }, { transfer: [buffer] });
      return;
    }
    const bytes = new Uint8Array(request.buffer);
    const project = request.fileName.toLowerCase().endsWith(".json")
      ? normalizeProject(JSON.parse(strFromU8(bytes)) as LegacyProject)
      : (() => {
          const files = unzipSync(bytes);
          const projectFile = files["project.json"];
          if (!projectFile) throw new Error("project.json이 없는 PawPlan 파일입니다.");
          return restoreAssets(normalizeProject(JSON.parse(strFromU8(projectFile)) as LegacyProject), files);
        })();
    self.postMessage({ id: request.id, ok: true, project });
  } catch (error) {
    self.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : "프로젝트 처리에 실패했습니다." });
  }
};

export {};
