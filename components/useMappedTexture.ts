"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ImageTransform } from "@/studio/domain/types";
import { getTextureUvTransform } from "@/lib/textureTransform";

type LoadedTexture = { texture: THREE.Texture; imageAspect: number };

export function useMappedTexture(
  image: string | undefined,
  settings: ImageTransform | undefined,
  surfaceAspect: number,
) {
  const [loaded, setLoaded] = useState<LoadedTexture | null>(null);
  const anisotropy = useThree((state) => Math.min(8, state.gl.capabilities.getMaxAnisotropy()));
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let active = true;
    setLoaded(null);
    if (!image) return;

    const loader = new THREE.TextureLoader();
    loader.load(
      image,
      (texture) => {
        if (!active) {
          texture.dispose();
          return;
        }
        const source = texture.image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
        const width = source.naturalWidth ?? source.width ?? 1;
        const height = source.naturalHeight ?? source.height ?? 1;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = anisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.matrixAutoUpdate = false;
        setLoaded({ texture, imageAspect: width / Math.max(height, 1) });
        invalidate();
      },
      undefined,
      () => active && setLoaded(null),
    );

    return () => {
      active = false;
    };
  }, [anisotropy, image, invalidate]);

  useEffect(() => () => loaded?.texture.dispose(), [loaded]);

  useEffect(() => {
    if (!loaded || !settings) return;
    const transform = getTextureUvTransform(surfaceAspect, loaded.imageAspect, settings);
    loaded.texture.matrix.setUvTransform(
      transform.offsetX,
      transform.offsetY,
      transform.repeatX,
      transform.repeatY,
      transform.rotation,
      0.5,
      0.5,
    );
    loaded.texture.needsUpdate = true;
    invalidate();
  }, [invalidate, loaded, settings, settings?.fit, settings?.rotation, settings?.x, settings?.y, settings?.zoom, surfaceAspect]);

  return loaded?.texture ?? null;
}

export function clipOutsideTransformedUv(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `#include <map_fragment>
    if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) {
      diffuseColor.a = 0.0;
    }`,
  );
}

export function clippedUvProgramKey() {
  return "pawplan-clipped-transformed-uv-v1";
}
