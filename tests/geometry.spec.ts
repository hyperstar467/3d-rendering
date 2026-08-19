import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { createEmptyAsset, createPart } from "../studio/domain/defaults";
import { buildGeometry } from "../studio/geometry/buildGeometry";
import { getAssetBounds } from "../studio/geometry/bounds";
import { clampInstance, placementClearances, rotatedFootprint, snapValue } from "../studio/space/placement";
import { prepareModelToDimensions } from "../lib/modelTransform";

function geometrySize(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.getSize(new THREE.Vector3()).multiplyScalar(1000);
}

test("Primitive and Sketch → Extrude create measured mesh geometry", () => {
  const box = buildGeometry({ kind: "primitive", primitive: "box", width: 800, depth: 400, height: 500 });
  const boxSize = geometrySize(box.geometry);
  expect(boxSize.x).toBeCloseTo(800, 3);
  expect(boxSize.y).toBeCloseTo(500, 3);
  expect(boxSize.z).toBeCloseTo(400, 3);
  expect(box.regions.map((region) => region.id)).toEqual(["right", "left", "top", "bottom", "front", "back"]);

  const extrude = buildGeometry({ kind: "extrude", depth: 120, sketch: { kind: "polygon", points: [{ x: -400, y: -250 }, { x: 400, y: -250 }, { x: 300, y: 350 }, { x: -300, y: 350 }] } });
  const size = geometrySize(extrude.geometry);
  expect(size.x).toBeCloseTo(800, 4);
  expect(size.y).toBeCloseTo(600, 4);
  expect(size.z).toBeCloseTo(120, 4);
  expect(extrude.regions.map((region) => region.id)).toEqual(["front", "back", "side"]);
  box.geometry.dispose();
  extrude.geometry.dispose();
});

test("Path → Sweep and Profile → Revolve create non-dummy meshes", () => {
  const sweep = buildGeometry({
    kind: "sweep",
    path: { curve: "catmull-rom", closed: false, points: [{ x: -500, y: 0, z: 0 }, { x: 0, y: 500, z: 100 }, { x: 500, y: 0, z: 0 }] },
    crossSection: { kind: "circle", radius: 35, segments: 20 },
  });
  const revolve = buildGeometry({ kind: "revolve", angle: 360, segments: 48, profile: [{ x: 0, y: -200 }, { x: 220, y: -200 }, { x: 280, y: 0 }, { x: 180, y: 300 }, { x: 0, y: 300 }] });
  expect(sweep.geometry.getAttribute("position").count).toBeGreaterThan(100);
  expect(revolve.geometry.getAttribute("position").count).toBeGreaterThan(100);
  expect(geometrySize(revolve.geometry).y).toBeCloseTo(500, 3);
  sweep.geometry.dispose();
  revolve.geometry.dispose();
});

test("Bend deforms vertices with editable angle, radius and range", () => {
  const source = { kind: "primitive", primitive: "box", width: 1200, height: 80, depth: 300 } as const;
  const plain = buildGeometry(source);
  const bent = buildGeometry(source, [{ id: "bend", kind: "bend", enabled: true, axis: "x", angle: 70, radius: 650, range: 0.55 }]);
  const original = plain.geometry.index ? plain.geometry.toNonIndexed() : plain.geometry;
  const changed = bent.geometry.getAttribute("position");
  const initial = original.getAttribute("position");
  let difference = 0;
  for (let index = 0; index < Math.min(initial.count, changed.count); index += 1) difference += Math.abs(initial.getZ(index) - changed.getZ(index));
  expect(difference).toBeGreaterThan(0.1);
  expect(geometrySize(bent.geometry).x).toBeGreaterThan(500);
  if (original !== plain.geometry) original.dispose();
  plain.geometry.dispose();
  bent.geometry.dispose();
});

test("Asset bounds, rotated placement and GLB measurement remain exact in mm", () => {
  const asset = createEmptyAsset("measured");
  asset.nodes.push(createPart({ kind: "primitive", primitive: "box", width: 1200, depth: 450, height: 1800 }, "Part"));
  const bounds = getAssetBounds(asset);
  expect(bounds.width).toBeCloseTo(1200, 3);
  expect(bounds.depth).toBeCloseTo(450, 3);
  expect(bounds.height).toBeCloseTo(1800, 3);
  const footprint = rotatedFootprint(1200, 450, 90);
  expect(footprint.width).toBeCloseTo(450, 5);
  expect(footprint.depth).toBeCloseTo(1200, 5);
  const placement = clampInstance({ width: 1200, depth: 450 }, { width: 6000, depth: 4000 }, 90, 9999, 9999);
  expect(placement.fits).toBe(true);
  if (placement.fits) expect({ x: placement.x, z: placement.z }).toEqual({ x: 2775, z: 1400 });
  expect(snapValue(123, 50)).toBe(100);
  expect(snapValue(68, 0)).toBe(68);
  const clearance = placementClearances({ width: 1200, depth: 450 }, { width: 6000, depth: 4000 }, 90, 100, 200);
  expect(clearance).toMatchObject({ left: 2875, right: 2675, back: 1600, front: 1200 });

  const glbSource = new THREE.Group();
  glbSource.add(new THREE.Mesh(new THREE.BoxGeometry(.5, 2, 1.25)));
  const measured = prepareModelToDimensions(glbSource, { width: 1200, depth: 450, height: 1800 }, { x: 0, y: 90, z: 0 });
  expect(measured.matchesTarget).toBe(true);
  expect(measured.measured.width).toBeCloseTo(1200, 2);
  expect(measured.measured.depth).toBeCloseTo(450, 2);
  expect(measured.measured.height).toBeCloseTo(1800, 2);
});
