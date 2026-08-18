import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { prepareModelToDimensions } from "../lib/modelTransform";
import { clampFixturePlacement, getRotatedFootprint } from "../lib/placement";

test("orientation and scale groups keep a 90-degree GLB at exact W/D/H", () => {
  const source = new THREE.Group();
  source.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 1.25), new THREE.MeshStandardMaterial()));
  const target = { width: 1200, depth: 450, height: 1800 };
  const prepared = prepareModelToDimensions(source, target, { x: 0, y: 90, z: 0 });

  expect(prepared.object.getObjectByName("measurement-scale-group")).toBeTruthy();
  expect(prepared.object.getObjectByName("orientation-group")).toBeTruthy();
  expect(prepared.matchesTarget).toBe(true);
  expect(prepared.measured.width).toBeCloseTo(1200, 5);
  expect(prepared.measured.depth).toBeCloseTo(450, 5);
  expect(prepared.measured.height).toBeCloseTo(1800, 5);
});

test("rotated footprint reclamps at the booth wall and rejects oversized fixtures", () => {
  const booth = { width: 6000, depth: 4000 };
  const fixture = { name: "진열대", width: 1200, depth: 450, rotation: 90 };
  const footprint = getRotatedFootprint(fixture.width, fixture.depth, fixture.rotation);
  expect(footprint.width).toBeCloseTo(450, 8);
  expect(footprint.depth).toBeCloseTo(1200, 8);
  const atWall = clampFixturePlacement(fixture, booth, 9999, 9999);
  expect(atWall.fits).toBe(true);
  if (atWall.fits) expect({ x: atWall.x, z: atWall.z }).toEqual({ x: 2775, z: 1400 });

  const oversized = clampFixturePlacement({ ...fixture, width: 7000, rotation: 0 }, booth, 0, 0);
  expect(oversized.fits).toBe(false);
  if (!oversized.fits) expect(oversized.message).toContain("부스 6000 × 4000 mm보다 큽니다");
});
