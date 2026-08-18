export type WallMode = "back" | "three" | "none";
export type WallSide = "back" | "left" | "right";
export type ViewPreset = "perspective" | "top" | "front";
export type FloorMaterial = "dark-carpet" | "light-carpet" | "concrete" | "gray-tile" | "white-tile" | "wood" | "custom";
export type FixtureCategory =
  | "display"
  | "counter"
  | "table"
  | "shelf"
  | "showcase"
  | "plinth"
  | "chair"
  | "stool"
  | "sofa"
  | "rack"
  | "partition"
  | "banner"
  | "custom";

export type FixtureFace = "front" | "left" | "right" | "back";
export type TextureFit = "contain" | "cover";
export type ModelRotation = { x: number; y: number; z: number };
export type GlbMaterialMode = "original" | "override";

export type TextureTransformSettings = {
  image?: string;
  fit: TextureFit;
  zoom: number;
  x: number;
  y: number;
  rotation: number;
};

export type FaceTextureSettings = TextureTransformSettings;
export type SurfaceTextureSettings = TextureTransformSettings;

export type BoothSettings = {
  width: number;
  depth: number;
  height: number;
  wallMode: WallMode;
  wallColor: string;
  floorColor: string;
  floorMaterial: FloorMaterial;
  showGrid: boolean;
  floorSurface: SurfaceTextureSettings;
  wallSurfaces: Record<WallSide, SurfaceTextureSettings>;
};

export type Fixture = {
  id: string;
  name: string;
  category: FixtureCategory;
  width: number;
  depth: number;
  height: number;
  x: number;
  z: number;
  rotation: number;
  color: string;
  modelUrl?: string;
  source: "primitive" | "photo" | "upload";
  modelRotation?: ModelRotation;
  glbMaterialMode?: GlbMaterialMode;
  faceTextures?: Partial<Record<FixtureFace, FaceTextureSettings>>;
};

export type AssetManifest = Record<string, { mimeType: string }>;

export type ProjectData = {
  version: 3;
  name: string;
  booth: BoothSettings;
  fixtures: Fixture[];
  savedAt: string;
  assets?: AssetManifest;
};

export const DEFAULT_TEXTURE_TRANSFORM: TextureTransformSettings = {
  fit: "contain",
  zoom: 1,
  x: 0,
  y: 0,
  rotation: 0,
};

export const DEFAULT_FACE_TEXTURE: FaceTextureSettings = DEFAULT_TEXTURE_TRANSFORM;
