"use client";

import { Component, Suspense, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import type { ModelDimensions } from "@/lib/modelTransform";
import type { GlbMaterialMode, ModelRotation } from "@/lib/types";
import { MeasuredGlb } from "@/components/MeasuredGlb";

type Props = ModelDimensions & {
  modelUrl: string;
  rotation: ModelRotation;
  materialMode?: GlbMaterialMode;
  color?: string;
};

class ReviewErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ModelReview(props: Props) {
  const [measurement, setMeasurement] = useState<(ModelDimensions & { matches: boolean }) | null>(null);
  const max = Math.max(props.width, props.depth, props.height) / 1000;
  return (
    <div className="model-review-canvas" data-testid="glb-preview" data-material-mode={props.materialMode ?? "original"} data-color={props.color ?? ""}>
      <Canvas frameloop="demand" shadows="basic" camera={{ position: [max * 1.7, max * 1.25, max * 1.9], fov: 38, near: 0.01, far: 100 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#eee9e1"]} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} castShadow />
        <ReviewErrorBoundary key={props.modelUrl} fallback={<Html center><div className="model-loading model-error">GLB 경계 크기를 측정할 수 없습니다.</div></Html>}>
          <Suspense fallback={<Html center><div className="model-loading">3D 모델을 준비하는 중…</div></Html>}>
            <MeasuredGlb {...props} onMeasured={setMeasurement} />
          </Suspense>
        </ReviewErrorBoundary>
        <ContactShadows frames={1} resolution={256} position={[0, 0.002, 0]} opacity={0.2} scale={Math.max(3, max * 3)} blur={2} far={max * 2} />
        <OrbitControls makeDefault enableDamping minDistance={Math.max(0.5, max * 0.7)} maxDistance={Math.max(5, max * 8)} target={[0, props.height / 2000, 0]} />
      </Canvas>
      <div className={`measurement-badge ${measurement?.matches ? "matches" : ""}`}>
        {measurement
          ? `${Math.round(measurement.width)} × ${Math.round(measurement.depth)} × ${Math.round(measurement.height)} mm · ${measurement.matches ? "실측 일치" : "불일치"}`
          : "BoundingBox 측정 중…"}
      </div>
      <div className="review-orbit-hint">Orientation → Scale 분리 검수 · 드래그 회전</div>
    </div>
  );
}
