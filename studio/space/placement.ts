import type { SpaceDefinition } from "@/studio/domain/types";

export type AssetFootprint = { width: number; depth: number };

export function rotatedFootprint(width: number, depth: number, rotation: number): AssetFootprint {
  const radians = rotation * Math.PI / 180;
  return {
    width: Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * depth,
    depth: Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * depth,
  };
}

export function clampInstance(
  dimensions: AssetFootprint,
  space: Pick<SpaceDefinition, "width" | "depth">,
  rotation: number,
  x: number,
  z: number,
) {
  const footprint = rotatedFootprint(dimensions.width, dimensions.depth, rotation);
  if (footprint.width > space.width + 0.001 || footprint.depth > space.depth + 0.001) {
    return { fits: false as const, footprint, message: `회전 후 오브젝트 크기 ${Math.round(footprint.width)} × ${Math.round(footprint.depth)} mm가 공간 ${space.width} × ${space.depth} mm보다 큽니다.` };
  }
  const maxX = (space.width - footprint.width) / 2;
  const maxZ = (space.depth - footprint.depth) / 2;
  return {
    fits: true as const,
    footprint,
    x: Math.min(maxX, Math.max(-maxX, x)),
    z: Math.min(maxZ, Math.max(-maxZ, z)),
  };
}
