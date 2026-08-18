import type {
  AssetDefinition,
  AssetNode,
  AssetPartNode,
  GeometrySource,
  HustleProject,
  ImageTransform,
  MaterialStyle,
  NodeTransform,
  SpaceDefinition,
} from "@/studio/domain/types";

export function createId(prefix = "node") {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const DEFAULT_IMAGE_TRANSFORM: ImageTransform = {
  fit: "contain",
  zoom: 1,
  x: 0,
  y: 0,
  rotation: 0,
};

export const DEFAULT_TRANSFORM: NodeTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

export const DEFAULT_LOCKS = { transform: false, edit: false } as const;
export const DEFAULT_PIVOT = { mode: "center", offset: { x: 0, y: 0, z: 0 } } as const;

export function normalizedNode<T extends AssetNode>(node: T): T {
  return {
    ...node,
    locks: { ...DEFAULT_LOCKS, ...node.locks },
    pivot: { ...structuredClone(DEFAULT_PIVOT), ...node.pivot, offset: { ...DEFAULT_PIVOT.offset, ...node.pivot?.offset } },
  };
}

export function normalizeAsset(asset: AssetDefinition): AssetDefinition {
  return { ...asset, nodes: asset.nodes.map(normalizedNode) };
}

export function createMaterial(color = "#ff6b35"): MaterialStyle {
  return {
    color,
    roughness: 0.58,
    metalness: 0.04,
    opacity: 1,
    image: { ...DEFAULT_IMAGE_TRANSFORM },
  };
}

export function createPart(source: GeometrySource, name: string, color?: string): AssetPartNode {
  return {
    id: createId("part"),
    type: "part",
    parentId: null,
    name,
    visible: true,
    locks: { ...DEFAULT_LOCKS },
    pivot: structuredClone(DEFAULT_PIVOT),
    transform: structuredClone(DEFAULT_TRANSFORM),
    source,
    modifiers: [],
    material: createMaterial(color),
    regionMaterials: {},
  };
}

export function createEmptyAsset(name = "새 3D 오브젝트"): AssetDefinition {
  const now = new Date().toISOString();
  return {
    id: createId("asset"),
    schemaVersion: 1,
    name,
    description: "",
    nodes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultSpace(): SpaceDefinition {
  const surface = (color: string) => ({ ...DEFAULT_IMAGE_TRANSFORM, color });
  return {
    width: 6000,
    depth: 4000,
    height: 2500,
    wallMode: "three",
    gridVisible: true,
    floor: surface("#454847"),
    walls: {
      back: surface("#f1eee7"),
      left: surface("#f1eee7"),
      right: surface("#f1eee7"),
    },
    instances: [],
  };
}

export function createProject(): HustleProject {
  return {
    schemaVersion: 1,
    id: createId("project"),
    name: "Hustle 3D 프로젝트",
    assets: [],
    space: createDefaultSpace(),
    savedAt: new Date().toISOString(),
  };
}
