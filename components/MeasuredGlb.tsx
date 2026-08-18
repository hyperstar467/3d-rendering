"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ModelDimensions } from "@/lib/modelTransform";
import { prepareModelToDimensions } from "@/lib/modelTransform";
import type { EulerDegrees, MaterialStyle } from "@/studio/domain/types";
import { useMappedTexture } from "@/components/useMappedTexture";

type Props = ModelDimensions & {
  modelUrl: string;
  rotation: EulerDegrees;
  materialMode?: "original" | "override";
  color?: string;
  material?: MaterialStyle;
  onMeasured?: (result: ModelDimensions & { matches: boolean }) => void;
};

export function MeasuredGlb({ materialMode = "original", color = "#d9d2c7", material, onMeasured, ...props }: Props) {
  const gltf = useGLTF(props.modelUrl);
  const mappedTexture = useMappedTexture(material?.image.image, material?.image, 1);
  const invalidate = useThree((state) => state.invalidate);
  const prepared = useMemo(
    () => prepareModelToDimensions(gltf.scene, props, props.rotation),
    [gltf.scene, props.depth, props.height, props.rotation.x, props.rotation.y, props.rotation.z, props.width],
  );
  const overrideMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.04 }),
    [],
  );

  useEffect(() => () => overrideMaterial.dispose(), [overrideMaterial]);

  useLayoutEffect(() => {
    overrideMaterial.color.set(material?.color ?? color);
    overrideMaterial.roughness = material?.roughness ?? 0.62;
    overrideMaterial.metalness = material?.metalness ?? 0.04;
    overrideMaterial.opacity = material?.opacity ?? 1;
    overrideMaterial.transparent = (material?.opacity ?? 1) < 1;
    overrideMaterial.map = mappedTexture;
    overrideMaterial.needsUpdate = true;
    invalidate();
  }, [color, invalidate, mappedTexture, material?.color, material?.metalness, material?.opacity, material?.roughness, overrideMaterial]);

  useLayoutEffect(() => {
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    prepared.object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      originals.set(child, child.material);
      if (materialMode === "override") child.material = overrideMaterial;
    });
    invalidate();
    return () => originals.forEach((material, mesh) => { mesh.material = material; });
  }, [invalidate, materialMode, overrideMaterial, prepared.object]);

  useEffect(() => {
    onMeasured?.({ ...prepared.measured, matches: prepared.matchesTarget });
  }, [onMeasured, prepared.matchesTarget, prepared.measured]);

  return <primitive object={prepared.object} />;
}
