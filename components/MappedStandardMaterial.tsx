"use client";

import { useThree, type ThreeElements } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { patchImageMapShader } from "@/components/useMappedTexture";

type Props = Omit<ThreeElements["meshStandardMaterial"], "map" | "onBeforeCompile" | "customProgramCacheKey"> & {
  texture: THREE.Texture | null;
  programNamespace: string;
};

export function MappedStandardMaterial({ texture, programNamespace, ...props }: Props) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);
  const hasMap = Boolean(texture);
  const onBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    if (hasMap) patchImageMapShader(shader);
  }, [hasMap]);
  const customProgramCacheKey = useCallback(
    () => `${programNamespace}-${hasMap ? "map" : "color"}-v2`,
    [hasMap, programNamespace],
  );

  useLayoutEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    const hadMap = Boolean(material.map);
    if (material.map !== texture) material.map = texture;
    if (hadMap !== hasMap) material.needsUpdate = true;
    invalidate();
  }, [hasMap, invalidate, texture]);

  return (
    <meshStandardMaterial
      ref={materialRef}
      {...props}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={customProgramCacheKey}
    />
  );
}
