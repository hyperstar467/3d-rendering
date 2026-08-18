import * as THREE from "three";
import type { ModelRotation } from "@/lib/types";

export type ModelDimensions = { width: number; depth: number; height: number };

export type PreparedModel = {
  object: THREE.Group;
  measured: ModelDimensions;
  matchesTarget: boolean;
};

const EPSILON_METERS = 0.001;

export function measureObjectMillimeters(object: THREE.Object3D): ModelDimensions {
  object.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  return {
    width: size.x * 1000,
    depth: size.z * 1000,
    height: size.y * 1000,
  };
}

export function dimensionsMatchTarget(measured: ModelDimensions, target: ModelDimensions, toleranceMm = 1) {
  return (
    Math.abs(measured.width - target.width) <= toleranceMm &&
    Math.abs(measured.depth - target.depth) <= toleranceMm &&
    Math.abs(measured.height - target.height) <= toleranceMm
  );
}

export function prepareModelToDimensions(
  source: THREE.Object3D,
  target: ModelDimensions,
  rotation: ModelRotation,
): PreparedModel {
  const model = source.clone(true);
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const orientationGroup = new THREE.Group();
  orientationGroup.name = "orientation-group";
  orientationGroup.add(model);
  orientationGroup.rotation.set(
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z),
  );
  orientationGroup.updateMatrixWorld(true);

  const orientedSize = new THREE.Box3().setFromObject(orientationGroup).getSize(new THREE.Vector3());
  if (orientedSize.x < EPSILON_METERS || orientedSize.y < EPSILON_METERS || orientedSize.z < EPSILON_METERS) {
    throw new Error("GLB 모델의 경계 크기를 측정할 수 없습니다.");
  }

  const scaleGroup = new THREE.Group();
  scaleGroup.name = "measurement-scale-group";
  scaleGroup.add(orientationGroup);
  scaleGroup.scale.set(
    target.width / 1000 / orientedSize.x,
    target.height / 1000 / orientedSize.y,
    target.depth / 1000 / orientedSize.z,
  );
  scaleGroup.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(scaleGroup);
  const center = scaledBox.getCenter(new THREE.Vector3());
  scaleGroup.position.set(-center.x, -scaledBox.min.y, -center.z);

  const root = new THREE.Group();
  root.name = "model-root";
  root.add(scaleGroup);
  root.updateMatrixWorld(true);
  const measured = measureObjectMillimeters(root);

  return {
    object: root,
    measured,
    matchesTarget: dimensionsMatchTarget(measured, target),
  };
}
