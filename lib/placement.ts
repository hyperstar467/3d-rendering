import type { BoothSettings, Fixture } from "@/lib/types";

export type Footprint = { width: number; depth: number };
export type PlacementResult =
  | { fits: true; x: number; z: number; footprint: Footprint }
  | { fits: false; footprint: Footprint; message: string };

export function getRotatedFootprint(width: number, depth: number, rotation: number): Footprint {
  const radians = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * depth,
    depth: Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * depth,
  };
}

export function clampFixturePlacement(
  fixture: Pick<Fixture, "name" | "width" | "depth" | "rotation">,
  booth: Pick<BoothSettings, "width" | "depth">,
  x: number,
  z: number,
): PlacementResult {
  const footprint = getRotatedFootprint(fixture.width, fixture.depth, fixture.rotation);
  const tolerance = 0.001;

  if (footprint.width > booth.width + tolerance || footprint.depth > booth.depth + tolerance) {
    return {
      fits: false,
      footprint,
      message: `${fixture.name}의 회전 후 점유 크기 ${Math.round(footprint.width)} × ${Math.round(footprint.depth)} mm가 부스 ${booth.width} × ${booth.depth} mm보다 큽니다.`,
    };
  }

  const maxX = Math.max(0, (booth.width - footprint.width) / 2);
  const maxZ = Math.max(0, (booth.depth - footprint.depth) / 2);
  return {
    fits: true,
    x: Math.min(maxX, Math.max(-maxX, x)),
    z: Math.min(maxZ, Math.max(-maxZ, z)),
    footprint,
  };
}

export function isInsideBooth(
  fixture: Pick<Fixture, "name" | "width" | "depth" | "rotation" | "x" | "z">,
  booth: Pick<BoothSettings, "width" | "depth">,
) {
  const result = clampFixturePlacement(fixture, booth, fixture.x, fixture.z);
  return result.fits && Math.abs(result.x - fixture.x) < 0.001 && Math.abs(result.z - fixture.z) < 0.001;
}
