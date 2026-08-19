import { expect, test } from "@playwright/test";
import { createEmptyAsset, createId, createPart } from "../studio/domain/defaults";
import type { AssetGroupNode, AssetNode } from "../studio/domain/types";
import { ancestorsOf, descendantsOf, isEditLocked, isTransformLocked, reparentKeepingWorld, setWorldTransform, worldMatrix, worldTransform } from "../studio/domain/hierarchy";

function group(name: string, parentId: string | null = null): AssetGroupNode {
  return {
    id: createId("group"), type: "group", parentId, name, visible: true,
    locks: { transform: false, edit: false }, pivot: { mode: "center", offset: { x: 0, y: 0, z: 0 } },
    transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
  };
}

function expectMatrixClose(actual: number[], expected: number[]) {
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 7));
}

test("Nested Group transforms propagate and world-preserving reparent/ungroup is exact", () => {
  const asset = createEmptyAsset("Hierarchy Test");
  const groupA = group("Group A");
  groupA.transform.position.x = 400;
  groupA.transform.rotation.y = 25;
  const partA = createPart({ kind: "primitive", primitive: "box", width: 300, height: 300, depth: 300 }, "Part A");
  partA.parentId = groupA.id;
  const groupB = group("Group B", groupA.id);
  groupB.transform.position = { x: 600, y: 100, z: -250 };
  groupB.transform.rotation.y = 45;
  const partB = createPart({ kind: "primitive", primitive: "cylinder", radius: 80, height: 400, segments: 24 }, "Part B");
  partB.parentId = groupB.id;
  partB.transform.position.x = 220;
  const partC = createPart({ kind: "primitive", primitive: "sphere", radius: 140, segments: 24 }, "Part C");
  partC.parentId = groupB.id;
  partC.transform.position.z = 300;
  const partD = createPart({ kind: "primitive", primitive: "box", width: 200, height: 700, depth: 200 }, "Part D");
  asset.nodes = [groupA, partA, groupB, partB, partC, partD];

  expect(ancestorsOf(partC.id, asset.nodes).map((node) => node.name)).toEqual(["Group A", "Group B"]);
  expect(descendantsOf(groupA.id, asset.nodes).map((node) => node.name)).toEqual(["Part A", "Group B", "Part B", "Part C"]);
  const beforeB = worldMatrix(groupB.id, asset.nodes).elements;
  const beforePartB = worldMatrix(partB.id, asset.nodes).elements;
  asset.nodes = reparentKeepingWorld(asset.nodes, groupB.id, null);
  expectMatrixClose(worldMatrix(groupB.id, asset.nodes).elements, beforeB);
  expectMatrixClose(worldMatrix(partB.id, asset.nodes).elements, beforePartB);

  const childIds = asset.nodes.filter((node) => node.parentId === groupB.id).map((node) => node.id);
  childIds.forEach((id) => { asset.nodes = reparentKeepingWorld(asset.nodes, id, groupB.parentId); });
  asset.nodes = asset.nodes.filter((node) => node.id !== groupB.id);
  expectMatrixClose(worldMatrix(partB.id, asset.nodes).elements, beforePartB);
});

test("Hierarchy depth is unbounded and transform/edit locks follow inheritance rules", () => {
  const nodes: AssetNode[] = [];
  let parentId: string | null = null;
  for (let index = 0; index < 16; index += 1) {
    const next = group(`Group ${index}`, parentId);
    nodes.push(next);
    parentId = next.id;
  }
  const leaf = createPart({ kind: "primitive", primitive: "box", width: 100, height: 100, depth: 100 }, "Leaf");
  leaf.parentId = parentId;
  nodes.push(leaf);
  expect(ancestorsOf(leaf.id, nodes)).toHaveLength(16);

  nodes[0].locks.transform = true;
  expect(isTransformLocked(nodes[0].id, nodes)).toBe(true);
  expect(isTransformLocked(leaf.id, nodes)).toBe(false);
  nodes[4].locks.edit = true;
  expect(isEditLocked(leaf.id, nodes)).toBe(true);
  expect(isTransformLocked(leaf.id, nodes)).toBe(true);
});

test("World-coordinate edits preserve the child hierarchy and convert back to local transforms", () => {
  const parent = group("Rotated parent");
  parent.transform.position = { x: 400, y: 50, z: -300 };
  parent.transform.rotation.y = 90;
  const child = createPart({ kind: "primitive", primitive: "box", width: 200, height: 300, depth: 400 }, "Child");
  child.parentId = parent.id;
  child.transform.position = { x: 250, y: 0, z: 100 };
  let nodes: AssetNode[] = [parent, child];
  const before = worldTransform(child.id, nodes)!;
  const desired = { ...before, position: { ...before.position, x: before.position.x + 725 }, rotation: { ...before.rotation, y: 15 } };
  nodes = setWorldTransform(nodes, child.id, desired);
  const after = worldTransform(child.id, nodes)!;
  expect(after.position.x).toBeCloseTo(desired.position.x, 7);
  expect(after.position.y).toBeCloseTo(desired.position.y, 7);
  expect(after.position.z).toBeCloseTo(desired.position.z, 7);
  expect(after.rotation.y).toBeCloseTo(desired.rotation.y, 7);
  expect(nodes.find((node) => node.id === parent.id)?.transform).toEqual(parent.transform);
});
