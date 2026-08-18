export type WallMode = "back" | "three" | "none";
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
  wallImage?: string;
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
  thumbnailUrl?: string;
  source?: "primitive" | "meshy" | "upload";
  modelRotation?: { x: number; y: number; z: number };
};

export type ProjectData = {
  version: 1;
  name: string;
  booth: BoothSettings;
  fixtures: Fixture[];
  savedAt: string;
};

export type MeshyTask = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "EXPIRED" | string;
  progress: number;
  model_urls?: { glb?: string };
  thumbnail_url?: string;
  task_error?: { message?: string };
};
