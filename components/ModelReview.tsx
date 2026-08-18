"use client";

import { Component, Suspense, useMemo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

type Props = {
  modelUrl: string;
  width: number;
  depth: number;
  height: number;
  rotation: { x: number; y: number; z: number };
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

function ReviewedModel({ modelUrl, width, depth, height, rotation }: Props) {
  const gltf = useGLTF(modelUrl);
  const prepared = useMemo(() => {
    const source = gltf.scene.clone(true);
    source.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const oriented = new THREE.Group();
    oriented.add(source);
    oriented.rotation.set(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z),
    );
    const box = new THREE.Box3().setFromObject(oriented);
    const size = box.getSize(new THREE.Vector3());
    const target = new THREE.Vector3(width / 1000, height / 1000, depth / 1000);
    oriented.scale.set(
      target.x / Math.max(size.x, 0.0001),
      target.y / Math.max(size.y, 0.0001),
      target.z / Math.max(size.z, 0.0001),
    );
    return oriented;
  }, [depth, gltf.scene, height, rotation.x, rotation.y, rotation.z, width]);

  return (
    <Center bottom>
      <primitive object={prepared} />
    </Center>
  );
}

export function ModelReview(props: Props) {
  return (
    <div className="model-review-canvas">
      <Canvas shadows="basic" camera={{ position: [2.7, 2.1, 3.2], fov: 38, near: 0.01, far: 100 }} dpr={[1, 2]}>
        <color attach="background" args={["#eee9e1"]} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} castShadow />
        <ReviewErrorBoundary key={props.modelUrl} fallback={<Html center><div className="model-loading model-error">GLB 파일을 표시할 수 없습니다. 다른 파일을 선택해 주세요.</div></Html>}>
          <Suspense fallback={<Html center><div className="model-loading">3D 모델을 준비하는 중…</div></Html>}>
            <ReviewedModel {...props} />
          </Suspense>
        </ReviewErrorBoundary>
        <gridHelper args={[5, 10, "#b9ad9d", "#d7cec1"]} position={[0, -0.002, 0]} />
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.7} enableDamping minDistance={1.5} maxDistance={8} />
      </Canvas>
      <div className="review-orbit-hint">드래그해서 회전 · 휠로 확대</div>
    </div>
  );
}
