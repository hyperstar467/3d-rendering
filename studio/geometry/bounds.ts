import * as THREE from "three";
import type { AssetDefinition, AssetNode } from "@/studio/domain/types";
import { buildGeometry } from "@/studio/geometry/buildGeometry";
import { descendantsOf, pivotOffset, worldTransform } from "@/studio/domain/hierarchy";

function applyTransform(object: THREE.Object3D, node: AssetNode) {
  object.position.set(node.transform.position.x / 1000, node.transform.position.y / 1000, node.transform.position.z / 1000);
  object.rotation.set(
    THREE.MathUtils.degToRad(node.transform.rotation.x),
    THREE.MathUtils.degToRad(node.transform.rotation.y),
    THREE.MathUtils.degToRad(node.transform.rotation.z),
  );
  object.scale.set(node.transform.scale.x, node.transform.scale.y, node.transform.scale.z);
}

function createNodeObject(node: AssetNode, all: AssetNode[]): THREE.Object3D {
  const object = new THREE.Group();
  applyTransform(object, node);
  const pivot = pivotOffset(node);
  const content = new THREE.Group();
  content.position.set(-pivot.x / 1000, -pivot.y / 1000, -pivot.z / 1000);
  object.add(content);
  if (node.type === "part") {
    const geometry = node.source.kind === "glb"
      ? new THREE.BoxGeometry(node.source.dimensions.width / 1000, node.source.dimensions.height / 1000, node.source.dimensions.depth / 1000)
      : buildGeometry(node.source, node.modifiers).geometry;
    content.add(new THREE.Mesh(geometry));
  }
  all.filter((candidate) => candidate.parentId === node.id).forEach((child) => content.add(createNodeObject(child, all)));
  return object;
}

export function getAssetBounds(asset: AssetDefinition) {
  const root = new THREE.Group();
  asset.nodes.filter((node) => node.parentId === null).forEach((node) => root.add(createNodeObject(node, asset.nodes)));
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  if (box.isEmpty()) return { width: 0, depth: 0, height: 0, center: { x: 0, y: 0, z: 0 } };
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return {
    width: size.x * 1000,
    depth: size.z * 1000,
    height: size.y * 1000,
    center: { x: center.x * 1000, y: center.y * 1000, z: center.z * 1000 },
  };
}

export function getSelectionBounds(asset: AssetDefinition, rootIds: string[]) {
  const rootSet = new Set(rootIds);
  const included = new Set(rootIds.flatMap((id) => [id, ...descendantsOf(id, asset.nodes).map((node) => node.id)]));
  const roots = asset.nodes.filter((node) => rootSet.has(node.id));
  const commonParent = roots.length && roots.every((node) => node.parentId === roots[0].parentId) ? roots[0].parentId : null;
  const nodes = asset.nodes.filter((node) => included.has(node.id)).map((node) => {
    const clone = structuredClone(node);
    if (!rootSet.has(node.id)) return clone;
    clone.parentId = null;
    if (!commonParent) clone.transform = worldTransform(node.id, asset.nodes) ?? clone.transform;
    return clone;
  });
  return { bounds: getAssetBounds({ ...asset, nodes }), parentId: commonParent };
}
