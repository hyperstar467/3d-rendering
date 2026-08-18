"use client";

import * as THREE from "three";
import type { FaceTextureSettings, Fixture, FixtureFace } from "@/lib/types";
import { clippedUvProgramKey, clipOutsideTransformedUv, useMappedTexture } from "@/components/useMappedTexture";

function FacePlane({
  face,
  settings,
  width,
  height,
  position,
  rotation,
}: {
  face: FixtureFace;
  settings?: FaceTextureSettings;
  width: number;
  height: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const texture = useMappedTexture(settings?.image, settings, width / Math.max(height, 1));
  if (!texture) return null;
  return (
    <mesh name={`photo-face-${face}`} position={position} rotation={rotation} castShadow receiveShadow>
      <planeGeometry args={[width / 1000, height / 1000]} />
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.72}
        side={THREE.DoubleSide}
        transparent
        alphaTest={0.001}
        depthWrite={false}
        onBeforeCompile={clipOutsideTransformedUv}
        customProgramCacheKey={clippedUvProgramKey}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

export function FixtureBox({ fixture }: { fixture: Pick<Fixture, "width" | "depth" | "height" | "color" | "faceTextures"> }) {
  const width = fixture.width / 1000;
  const depth = fixture.depth / 1000;
  const height = fixture.height / 1000;
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={fixture.color} roughness={0.68} />
      </mesh>
      <FacePlane face="front" settings={fixture.faceTextures?.front} width={fixture.width} height={fixture.height} position={[0, height / 2, depth / 2 + 0.0005]} />
      <FacePlane face="back" settings={fixture.faceTextures?.back} width={fixture.width} height={fixture.height} position={[0, height / 2, -depth / 2 - 0.0005]} rotation={[0, Math.PI, 0]} />
      <FacePlane face="left" settings={fixture.faceTextures?.left} width={fixture.depth} height={fixture.height} position={[-width / 2 - 0.0005, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <FacePlane face="right" settings={fixture.faceTextures?.right} width={fixture.depth} height={fixture.height} position={[width / 2 + 0.0005, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}
