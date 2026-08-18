import * as THREE from "three";
import { normalizedNode } from "@/studio/domain/defaults";
import type { AssetDefinition, AssetNode, NodePivot, NodeTransform, Vector3Mm } from "@/studio/domain/types";
import { buildGeometry } from "@/studio/geometry/buildGeometry";

export function childrenOf(nodes: AssetNode[], parentId: string | null) {
  return nodes.filter((node) => node.parentId === parentId);
}

export function ancestorsOf(nodeId: string, nodes: AssetNode[]) {
  const ancestors: AssetNode[] = [];
  let current = nodes.find((node) => node.id === nodeId);
  const visited = new Set<string>();
  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    const parent = nodes.find((node) => node.id === current!.parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

export function descendantsOf(nodeId: string, nodes: AssetNode[]) {
  const result: AssetNode[] = [];
  const visit = (parentId: string) => childrenOf(nodes, parentId).forEach((child) => {
    result.push(child);
    visit(child.id);
  });
  visit(nodeId);
  return result;
}

export function isDescendant(nodeId: string, possibleAncestorId: string, nodes: AssetNode[]) {
  return ancestorsOf(nodeId, nodes).some((ancestor) => ancestor.id === possibleAncestorId);
}

export function isEditLocked(nodeId: string, nodes: AssetNode[]) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  return Boolean(node?.locks?.edit || ancestorsOf(nodeId, nodes).some((ancestor) => ancestor.locks?.edit));
}

export function isTransformLocked(nodeId: string, nodes: AssetNode[]) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  return Boolean(node?.locks?.transform || isEditLocked(nodeId, nodes));
}

export function pivotOffset(node: AssetNode): Vector3Mm {
  if (node.pivot?.mode === "custom") return node.pivot.offset;
  if (node.pivot?.mode !== "bottom-center" || node.type !== "part") return { x: 0, y: 0, z: 0 };
  if (node.source.kind === "glb") return { x: 0, y: -node.source.dimensions.height / 2, z: 0 };
  const built = buildGeometry(node.source, node.modifiers);
  built.geometry.computeBoundingBox();
  const y = (built.geometry.boundingBox?.min.y ?? 0) * 1000;
  built.geometry.dispose();
  return { x: 0, y, z: 0 };
}

export function effectiveLocalMatrix(node: AssetNode) {
  const position = new THREE.Vector3(node.transform.position.x / 1000, node.transform.position.y / 1000, node.transform.position.z / 1000);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(node.transform.rotation.x),
    THREE.MathUtils.degToRad(node.transform.rotation.y),
    THREE.MathUtils.degToRad(node.transform.rotation.z),
  ));
  const scale = new THREE.Vector3(node.transform.scale.x, node.transform.scale.y, node.transform.scale.z);
  const pivot = pivotOffset(node);
  return new THREE.Matrix4().compose(position, rotation, scale).multiply(new THREE.Matrix4().makeTranslation(-pivot.x / 1000, -pivot.y / 1000, -pivot.z / 1000));
}

export function worldMatrix(nodeId: string, nodes: AssetNode[]) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return new THREE.Matrix4();
  return ancestorsOf(nodeId, nodes).reduce((matrix, ancestor) => matrix.multiply(effectiveLocalMatrix(ancestor)), new THREE.Matrix4()).multiply(effectiveLocalMatrix(node));
}

function transformFromEffectiveMatrix(matrix: THREE.Matrix4, pivot: NodePivot): NodeTransform {
  const effective = matrix.clone().multiply(new THREE.Matrix4().makeTranslation(pivot.offset.x / 1000, pivot.offset.y / 1000, pivot.offset.z / 1000));
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  effective.decompose(position, quaternion, scale);
  const rotation = new THREE.Euler().setFromQuaternion(quaternion);
  const clean = (value: number) => Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(9));
  return {
    position: { x: clean(position.x * 1000), y: clean(position.y * 1000), z: clean(position.z * 1000) },
    rotation: { x: clean(THREE.MathUtils.radToDeg(rotation.x)), y: clean(THREE.MathUtils.radToDeg(rotation.y)), z: clean(THREE.MathUtils.radToDeg(rotation.z)) },
    scale: { x: clean(scale.x), y: clean(scale.y), z: clean(scale.z) },
  };
}

export function worldTransform(nodeId: string, nodes: AssetNode[]) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return undefined;
  return transformFromEffectiveMatrix(worldMatrix(nodeId, nodes), { ...node.pivot, offset: pivotOffset(node) });
}

export function setWorldTransform(nodes: AssetNode[], nodeId: string, transform: NodeTransform) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node || isTransformLocked(nodeId, nodes)) return nodes;
  const pivot = pivotOffset(node);
  const desiredWorld = new THREE.Matrix4().compose(
    new THREE.Vector3(transform.position.x / 1000, transform.position.y / 1000, transform.position.z / 1000),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(transform.rotation.x),
      THREE.MathUtils.degToRad(transform.rotation.y),
      THREE.MathUtils.degToRad(transform.rotation.z),
    )),
    new THREE.Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
  ).multiply(new THREE.Matrix4().makeTranslation(-pivot.x / 1000, -pivot.y / 1000, -pivot.z / 1000));
  const parentWorld = node.parentId ? worldMatrix(node.parentId, nodes) : new THREE.Matrix4();
  const localEffective = parentWorld.clone().invert().multiply(desiredWorld);
  const localTransform = transformFromEffectiveMatrix(localEffective, { ...node.pivot, offset: pivot });
  return nodes.map((candidate) => candidate.id === nodeId ? { ...candidate, transform: localTransform } : candidate);
}

export function canReparent(nodeId: string, parentId: string | null, nodes: AssetNode[]) {
  if (nodeId === parentId) return false;
  if (!parentId) return true;
  const parent = nodes.find((node) => node.id === parentId);
  return parent?.type === "group" && !isDescendant(parentId, nodeId, nodes);
}

export function reparentKeepingWorld(nodes: AssetNode[], nodeId: string, parentId: string | null) {
  if (!canReparent(nodeId, parentId, nodes)) return nodes;
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.parentId === parentId || isEditLocked(nodeId, nodes) || (parentId ? isEditLocked(parentId, nodes) : false)) return nodes;
  const originalWorld = worldMatrix(nodeId, nodes);
  const parentWorld = parentId ? worldMatrix(parentId, nodes) : new THREE.Matrix4();
  const effectiveLocal = parentWorld.clone().invert().multiply(originalWorld);
  const normalized = normalizedNode(node);
  const pivot = { ...normalized.pivot, offset: pivotOffset(normalized) };
  const transform = transformFromEffectiveMatrix(effectiveLocal, pivot);
  return nodes.map((candidate) => candidate.id === nodeId ? { ...candidate, parentId, transform } : candidate);
}

export function selectionPath(nodeId: string | undefined, nodes: AssetNode[], assetName: string) {
  if (!nodeId) return [assetName];
  const node = nodes.find((candidate) => candidate.id === nodeId);
  return [assetName, ...ancestorsOf(nodeId, nodes).map((ancestor) => ancestor.name), ...(node ? [node.name] : [])];
}
