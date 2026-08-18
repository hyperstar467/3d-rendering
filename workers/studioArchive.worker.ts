/// <reference lib="webworker" />

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { HustleProject, ImageTransform, MaterialStyle } from "@/studio/domain/types";
import { normalizeAsset } from "@/studio/domain/defaults";

type Request =
  | { id: string; type: "create"; project: HustleProject }
  | { id: string; type: "read"; buffer: ArrayBuffer };

type Manifest = Record<string, { mimeType: string }>;
type PortableProject = HustleProject & { assetManifest?: Manifest };

function decodeDataUrl(value: string) {
  const comma = value.indexOf(",");
  if (!value.startsWith("data:") || comma < 0) return null;
  const metadata = value.slice(5, comma);
  const mimeType = metadata.split(";")[0] || "application/octet-stream";
  const body = value.slice(comma + 1);
  return {
    mimeType,
    bytes: metadata.includes(";base64")
      ? Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
      : strToU8(decodeURIComponent(body)),
  };
}

function encodeDataUrl(bytes: Uint8Array, mimeType: string) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function extension(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("gltf-binary")) return "glb";
  return "bin";
}

function makePortable(project: HustleProject) {
  const portable = structuredClone(project) as PortableProject;
  const files: Record<string, Uint8Array> = {};
  const manifest: Manifest = {};
  const store = (value: string | undefined, path: string) => {
    if (!value) return value;
    const decoded = decodeDataUrl(value);
    if (!decoded) return value;
    const fullPath = `${path}.${extension(decoded.mimeType)}`;
    files[fullPath] = decoded.bytes;
    manifest[fullPath] = { mimeType: decoded.mimeType };
    return `asset://${fullPath}`;
  };
  const storeImage = (image: ImageTransform, path: string) => { image.image = store(image.image, path); };
  const storeMaterial = (material: MaterialStyle, path: string) => storeImage(material.image, path);

  storeImage(portable.space.floor, "assets/space/floor");
  Object.entries(portable.space.walls).forEach(([side, surface]) => storeImage(surface, `assets/space/${side}-wall`));
  portable.assets.forEach((asset) => asset.nodes.forEach((node) => {
    if (node.type !== "part") return;
    const root = `assets/objects/${asset.id}/${node.id}`;
    storeMaterial(node.material, `${root}/material-default`);
    Object.entries(node.regionMaterials).forEach(([region, material]) => storeMaterial(material, `${root}/material-${region}`));
    if (node.source.kind === "glb") node.source.dataUrl = store(node.source.dataUrl, `${root}/model`) ?? node.source.dataUrl;
  }));
  portable.assetManifest = manifest;
  files["project.json"] = strToU8(JSON.stringify(portable, null, 2));
  return zipSync(files, { level: 1 });
}

function restore(portable: PortableProject, files: Record<string, Uint8Array>) {
  if (portable.schemaVersion !== 1 || !Array.isArray(portable.assets) || !portable.space) throw new Error("지원하지 않는 Hustle 3D 프로젝트입니다.");
  const manifest = portable.assetManifest ?? {};
  const load = (value?: string) => {
    if (!value?.startsWith("asset://")) return value;
    const path = value.slice("asset://".length);
    const bytes = files[path];
    if (!bytes) throw new Error(`프로젝트 자산이 누락되었습니다: ${path}`);
    return encodeDataUrl(bytes, manifest[path]?.mimeType ?? "application/octet-stream");
  };
  const loadImage = (image: ImageTransform) => { image.image = load(image.image); };
  const loadMaterial = (material: MaterialStyle) => loadImage(material.image);
  loadImage(portable.space.floor);
  Object.values(portable.space.walls).forEach(loadImage);
  portable.assets.forEach((asset) => asset.nodes.forEach((node) => {
    if (node.type !== "part") return;
    loadMaterial(node.material);
    Object.values(node.regionMaterials).forEach(loadMaterial);
    if (node.source.kind === "glb") node.source.dataUrl = load(node.source.dataUrl) ?? node.source.dataUrl;
  }));
  delete portable.assetManifest;
  portable.assets = portable.assets.map(normalizeAsset);
  return portable;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.type === "create") {
      const bytes = makePortable(request.project);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      self.postMessage({ id: request.id, ok: true, buffer }, { transfer: [buffer] });
      return;
    }
    const files = unzipSync(new Uint8Array(request.buffer));
    const projectFile = files["project.json"];
    if (!projectFile) throw new Error("project.json이 없는 Hustle 3D 프로젝트입니다.");
    const project = restore(JSON.parse(strFromU8(projectFile)) as PortableProject, files);
    self.postMessage({ id: request.id, ok: true, project });
  } catch (error) {
    self.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : "프로젝트 처리에 실패했습니다." });
  }
};

export {};
