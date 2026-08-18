"use client";

import { Canvas } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from "@react-three/drei";
import { Suspense, useState } from "react";
import type { AssetDefinition, BendModifier, GeometrySource, NodeTransform } from "@/studio/domain/types";
import { AssetRenderer } from "@/components/studio/AssetRenderer";

type Props = {
  asset: AssetDefinition;
  selectedIds: string[];
  onSelect: (nodeId: string, additive: boolean) => void;
  onSourceChange: (nodeId: string, source: GeometrySource) => void;
  onBendChange: (nodeId: string, modifierId: string, patch: Partial<BendModifier>) => void;
  onTransformChange: (nodeId: string, transform: NodeTransform) => void;
  interactionMode: "view" | "place" | "geometry";
  isolateIds: string[];
  coordinateSpace: "local" | "world";
  materialPreview?: { nodeId: string; regionId: string; image: string };
};

export function AssetScene({ asset, selectedIds, onSelect, onSourceChange, onBendChange, onTransformChange, interactionMode, isolateIds, coordinateSpace, materialPreview }: Props) {
  const [controlsEnabled, setControlsEnabled] = useState(true);
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows={false}
      frameloop="demand"
      camera={{ position: [3.8, 3, 4.8], fov: 42, near: 0.01, far: 200 }}
      onPointerMissed={() => onSelect("", false)}
    >
      <color attach="background" args={["#e8e8e5"]} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[4, 7, 5]} intensity={2.4} />
      <directionalLight position={[-3, 2, -4]} intensity={0.8} />
      <Suspense fallback={null}>
        <AssetRenderer asset={asset} selectedIds={selectedIds} isolateIds={isolateIds} coordinateSpace={coordinateSpace} materialPreview={materialPreview} onSelect={onSelect} onSourceChange={onSourceChange} onBendChange={onBendChange} onTransformChange={onTransformChange} interactionMode={interactionMode} onManipulation={(active) => setControlsEnabled(!active)} />
      </Suspense>
      <Grid
        position={[0, -0.002, 0]}
        args={[12, 12]}
        cellSize={0.1}
        sectionSize={0.5}
        cellColor="#c9c9c3"
        sectionColor="#9b9b93"
        fadeDistance={18}
        infiniteGrid
      />
      <OrbitControls enabled={controlsEnabled && interactionMode === "view"} makeDefault minDistance={0.25} maxDistance={40} target={[0, 0.4, 0]} />
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.85} />
      </GizmoHelper>
    </Canvas>
  );
}
