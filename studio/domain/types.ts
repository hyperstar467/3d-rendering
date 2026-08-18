export type Id = string;

export type Vector2Mm = { x: number; y: number };
export type Vector3Mm = { x: number; y: number; z: number };
export type EulerDegrees = { x: number; y: number; z: number };

export type NodeTransform = {
  position: Vector3Mm;
  rotation: EulerDegrees;
  scale: Vector3Mm;
};

export type NodeLocks = {
  transform: boolean;
  edit: boolean;
};

export type NodePivot = {
  mode: "center" | "bottom-center" | "custom";
  offset: Vector3Mm;
};

export type TextureFit = "contain" | "cover";

export type ImageTransform = {
  image?: string;
  imageName?: string;
  fit: TextureFit;
  zoom: number;
  x: number;
  y: number;
  rotation: number;
};

export type MaterialStyle = {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  image: ImageTransform;
};

export type SketchDefinition =
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "circle"; radius: number; segments: number }
  | { kind: "polygon"; points: Vector2Mm[] }
  | {
      kind: "bezier";
      start: Vector2Mm;
      curves: Array<{ control1: Vector2Mm; control2: Vector2Mm; end: Vector2Mm }>;
    };

export type PathDefinition = {
  points: Vector3Mm[];
  curve: "linear" | "catmull-rom";
  closed: boolean;
};

export type CrossSection =
  | { kind: "circle"; radius: number; segments: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "thin-rectangle"; width: number; height: number };

export type GeometrySource =
  | { kind: "primitive"; primitive: "box"; width: number; height: number; depth: number }
  | { kind: "primitive"; primitive: "cylinder"; radius: number; height: number; segments: number }
  | { kind: "primitive"; primitive: "sphere"; radius: number; segments: number }
  | { kind: "primitive"; primitive: "cone"; radius: number; height: number; segments: number }
  | { kind: "primitive"; primitive: "rod"; radius: number; length: number; segments: number }
  | { kind: "primitive"; primitive: "bar"; width: number; height: number; length: number }
  | { kind: "extrude"; sketch: SketchDefinition; depth: number }
  | { kind: "sweep"; path: PathDefinition; crossSection: CrossSection }
  | { kind: "revolve"; profile: Vector2Mm[]; segments: number; angle: number }
  | {
      kind: "glb";
      dataUrl: string;
      fileName: string;
      dimensions: { width: number; depth: number; height: number };
      orientation: EulerDegrees;
      materialMode: "original" | "override";
    };

export type BendModifier = {
  id: Id;
  kind: "bend";
  enabled: boolean;
  axis: "x" | "y" | "z";
  angle: number;
  radius: number;
  range: number;
};

export type GeometryModifier = BendModifier;

export type AssetPartNode = {
  id: Id;
  type: "part";
  parentId: Id | null;
  name: string;
  visible: boolean;
  locks: NodeLocks;
  pivot: NodePivot;
  transform: NodeTransform;
  source: GeometrySource;
  modifiers: GeometryModifier[];
  material: MaterialStyle;
  regionMaterials: Record<string, MaterialStyle>;
};

export type AssetGroupNode = {
  id: Id;
  type: "group";
  parentId: Id | null;
  name: string;
  visible: boolean;
  locks: NodeLocks;
  pivot: NodePivot;
  transform: NodeTransform;
};

export type AssetNode = AssetPartNode | AssetGroupNode;

export type AssetDefinition = {
  id: Id;
  schemaVersion: 1;
  name: string;
  description: string;
  nodes: AssetNode[];
  createdAt: string;
  updatedAt: string;
};

export type AssetInstance = {
  id: Id;
  assetId: Id;
  name: string;
  position: { x: number; z: number };
  rotation: number;
};

export type SurfaceSettings = ImageTransform & { color: string };

export type SpaceDefinition = {
  width: number;
  depth: number;
  height: number;
  wallMode: "back" | "three" | "none";
  gridVisible: boolean;
  floor: SurfaceSettings;
  walls: {
    back: SurfaceSettings;
    left: SurfaceSettings;
    right: SurfaceSettings;
  };
  instances: AssetInstance[];
};

export type HustleProject = {
  schemaVersion: 1;
  id: Id;
  name: string;
  assets: AssetDefinition[];
  space: SpaceDefinition;
  savedAt: string;
};

export type MaterialRegion = { id: string; label: string };
