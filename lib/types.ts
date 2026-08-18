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

export type FaceTextureSettings = {
  image?: string;
  fit: TextureFit;
  zoom: number;
  x: number;
  y: number;
  rotation: number;
};

export type BoothSettings = {
  width: number;
  depth: number;
  height: number;
  wallMode: WallMode;
  wallColor: string;
  floorColor: string;
  floorMaterial: FloorMaterial;
  showGrid: boolean;
  floorImage?: string;
  wallImages: Partial<Record<WallSide, string>>;
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
  faceTextures?: Partial<Record<FixtureFace, FaceTextureSettings>>;
};

export type AssetManifest = Record<string, { mimeType: string }>;

export type ProjectData = {
  version: 2;
  name: string;
  booth: BoothSettings;
  fixtures: Fixture[];
  savedAt: string;
  assets?: AssetManifest;
};

export const DEFAULT_FACE_TEXTURE: FaceTextureSettings = {
  fit: "contain",
  zoom: 1,
  x: 0,
  y: 0,
  rotation: 0,
};
