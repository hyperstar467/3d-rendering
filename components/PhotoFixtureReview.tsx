"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { Fixture } from "@/lib/types";
import { FixtureBox } from "@/components/FixtureBox";

export function PhotoFixtureReview({ fixture }: { fixture: Pick<Fixture, "width" | "depth" | "height" | "color" | "faceTextures"> }) {
  const max = Math.max(fixture.width, fixture.depth, fixture.height) / 1000;
  const front = fixture.faceTextures?.front;
  return (
    <div
      className="model-review-canvas photo-review-canvas"
      data-testid="photo-fixture-preview"
      data-front-transform={front ? `${front.fit}:${front.zoom}:${front.x}:${front.y}:${front.rotation}` : "none"}
      data-color={fixture.color}
    >
      <Canvas frameloop="demand" shadows="basic" camera={{ position: [max * 1.7, max * 1.25, max * 1.9], fov: 38, near: 0.01, far: 100 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#eee9e1"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 5, 4]} intensity={2.1} castShadow />
        <FixtureBox fixture={fixture} />
        <ContactShadows frames={1} resolution={256} position={[0, 0.002, 0]} opacity={0.2} scale={Math.max(3, max * 3)} blur={2} far={max * 2} />
        <OrbitControls makeDefault enableDamping minDistance={Math.max(0.5, max * 0.7)} maxDistance={Math.max(5, max * 8)} target={[0, fixture.height / 2000, 0]} />
      </Canvas>
      <div className="review-orbit-hint">별도 3D 검수 · 드래그 회전 · 휠 확대</div>
    </div>
  );
}
