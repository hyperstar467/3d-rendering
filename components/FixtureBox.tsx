"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { FaceTextureSettings, Fixture, FixtureFace } from "@/lib/types";

function useFaceCanvasTexture(
  settings: FaceTextureSettings | undefined,
  faceWidth: number,
  faceHeight: number,
  color: string,
) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());

  useEffect(() => {
    let active = true;
    let current: THREE.Texture | null = null;
    if (!settings?.image) {
      setTexture(null);
      return;
    }

    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const aspect = faceWidth / Math.max(faceHeight, 1);
      const maxSize = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = aspect >= 1 ? maxSize : Math.max(128, Math.round(maxSize * aspect));
      canvas.height = aspect >= 1 ? Math.max(128, Math.round(maxSize / aspect)) : maxSize;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      const radians = THREE.MathUtils.degToRad(settings.rotation);
      const rotatedWidth = Math.abs(image.width * Math.cos(radians)) + Math.abs(image.height * Math.sin(radians));
      const rotatedHeight = Math.abs(image.width * Math.sin(radians)) + Math.abs(image.height * Math.cos(radians));
      const baseScale = settings.fit === "cover"
        ? Math.max(canvas.width / rotatedWidth, canvas.height / rotatedHeight)
        : Math.min(canvas.width / rotatedWidth, canvas.height / rotatedHeight);
      const scale = baseScale * settings.zoom;
      const centerX = canvas.width / 2 + (settings.x / 100) * (canvas.width / 2);
      const centerY = canvas.height / 2 - (settings.y / 100) * (canvas.height / 2);

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.save();
      context.translate(centerX, centerY);
      context.rotate(radians);
      context.drawImage(
        image,
        (-image.width * scale) / 2,
        (-image.height * scale) / 2,
        image.width * scale,
        image.height * scale,
      );
      context.restore();

      current = new THREE.CanvasTexture(canvas);
      current.colorSpace = THREE.SRGBColorSpace;
      current.wrapS = THREE.ClampToEdgeWrapping;
      current.wrapT = THREE.ClampToEdgeWrapping;
      current.anisotropy = anisotropy;
      current.minFilter = THREE.LinearMipmapLinearFilter;
      current.magFilter = THREE.LinearFilter;
      current.needsUpdate = true;
      setTexture(current);
    };
    image.src = settings.image;

    return () => {
      active = false;
      current?.dispose();
    };
  }, [anisotropy, color, faceHeight, faceWidth, settings?.fit, settings?.image, settings?.rotation, settings?.x, settings?.y, settings?.zoom]);

  return texture;
}

function FacePlane({
  face,
  settings,
  width,
  height,
  color,
  position,
  rotation,
}: {
  face: FixtureFace;
  settings?: FaceTextureSettings;
  width: number;
  height: number;
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const texture = useFaceCanvasTexture(settings, width, height, color);
  if (!texture) return null;
  return (
    <mesh name={`photo-face-${face}`} position={position} rotation={rotation} castShadow receiveShadow>
      <planeGeometry args={[width / 1000, height / 1000]} />
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.72}
        side={THREE.DoubleSide}
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
      <FacePlane face="front" settings={fixture.faceTextures?.front} width={fixture.width} height={fixture.height} color={fixture.color} position={[0, height / 2, depth / 2]} />
      <FacePlane face="back" settings={fixture.faceTextures?.back} width={fixture.width} height={fixture.height} color={fixture.color} position={[0, height / 2, -depth / 2]} rotation={[0, Math.PI, 0]} />
      <FacePlane face="left" settings={fixture.faceTextures?.left} width={fixture.depth} height={fixture.height} color={fixture.color} position={[-width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <FacePlane face="right" settings={fixture.faceTextures?.right} width={fixture.depth} height={fixture.height} color={fixture.color} position={[width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}
