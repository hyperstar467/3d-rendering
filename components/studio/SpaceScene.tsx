"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { Suspense, useMemo, useRef, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import { AssetRenderer } from "@/components/studio/AssetRenderer";
import { useMappedTexture } from "@/components/useMappedTexture";
import type { AssetDefinition, AssetInstance, SpaceDefinition, SurfaceSettings } from "@/studio/domain/types";
import { getAssetBounds } from "@/studio/geometry/bounds";
import { clampInstance } from "@/studio/space/placement";

type ControlsInstance = ComponentRef<typeof OrbitControls>;

type Props = {
  space: SpaceDefinition;
  assets: AssetDefinition[];
  selectedId?: string;
  onSelect: (instanceId?: string) => void;
  onMove: (instanceId: string, x: number, z: number) => void;
  onRotate: (instanceId: string, rotation: number, x: number, z: number) => void;
  onPlacementError: (message?: string) => void;
  interactionMode: "view" | "place";
};

function SurfaceMaterial({ surface, aspect }: { surface: SurfaceSettings; aspect: number }) {
  const texture = useMappedTexture(surface.image, surface, aspect);
  return (
    <meshStandardMaterial
      color={surface.color}
      map={texture}
      roughness={0.76}
      metalness={0}
      side={THREE.DoubleSide}
      onBeforeCompile={(shader) => {
        if (!texture) return;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `vec4 hustleBaseColor = diffuseColor;
          #include <map_fragment>
          if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) {
            diffuseColor = hustleBaseColor;
          } else {
            diffuseColor = vec4(sampledDiffuseColor.rgb, sampledDiffuseColor.a * hustleBaseColor.a);
          }`,
        );
      }}
      customProgramCacheKey={() => texture ? "hustle-surface-image-v1" : "hustle-surface-color-v1"}
    />
  );
}

function CustomGrid({ width, depth }: { width: number; depth: number }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const halfW = width / 2000;
    const halfD = depth / 2000;
    const step = 0.5;
    for (let x = -halfW; x <= halfW + 0.0001; x += step) points.push(x, 0.002, -halfD, x, 0.002, halfD);
    for (let z = -halfD; z <= halfD + 0.0001; z += step) points.push(-halfW, 0.002, z, halfW, 0.002, z);
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return next;
  }, [depth, width]);
  return <lineSegments geometry={geometry}><lineBasicMaterial color="#9d9e99" transparent opacity={0.6} /></lineSegments>;
}

function PlacedAsset({
  asset,
  instance,
  selected,
  space,
  controls,
  onSelect,
  onMove,
  onRotate,
  onPlacementError,
  interactionMode,
}: {
  asset: AssetDefinition;
  instance: AssetInstance;
  selected: boolean;
  space: SpaceDefinition;
  controls: RefObject<ControlsInstance | null>;
  onSelect: () => void;
  onMove: (x: number, z: number) => void;
  onRotate: (rotation: number, x: number, z: number) => void;
  onPlacementError: (message?: string) => void;
  interactionMode: "view" | "place";
}) {
  const bounds = useMemo(() => getAssetBounds(asset), [asset]);
  const drag = useRef<{ offsetX: number; offsetZ: number } | null>(null);
  const rotateDrag = useRef<{ clientX: number; rotation: number } | null>(null);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const intersectFloor = (event: ThreeEvent<PointerEvent>) => event.ray.intersectPlane(plane, new THREE.Vector3());
  const pointerDown = (event: ThreeEvent<PointerEvent>) => {
    onSelect();
    if (interactionMode !== "place") return;
    event.stopPropagation();
    const hit = intersectFloor(event);
    if (!hit) return;
    drag.current = { offsetX: instance.position.x - hit.x * 1000, offsetZ: instance.position.z - hit.z * 1000 };
    if (event.nativeEvent.target instanceof Element) event.nativeEvent.target.setPointerCapture(event.pointerId);
    if (controls.current) controls.current.enabled = false;
  };
  const rotateDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    rotateDrag.current = { clientX: event.nativeEvent.clientX, rotation: instance.rotation };
    if (event.nativeEvent.target instanceof Element) event.nativeEvent.target.setPointerCapture(event.pointerId);
    if (controls.current) controls.current.enabled = false;
  };
  const rotateMove = (event: ThreeEvent<PointerEvent>) => {
    if (!rotateDrag.current) return;
    event.stopPropagation();
    const rotation = rotateDrag.current.rotation + (event.nativeEvent.clientX - rotateDrag.current.clientX) * .7;
    const placement = clampInstance(bounds, space, rotation, instance.position.x, instance.position.z);
    if (!placement.fits) return onPlacementError(placement.message);
    onPlacementError(undefined);
    onRotate(rotation, placement.x, placement.z);
  };
  const rotateUp = (event: ThreeEvent<PointerEvent>) => {
    if (!rotateDrag.current) return;
    event.stopPropagation();
    rotateDrag.current = null;
    if (event.nativeEvent.target instanceof Element && event.nativeEvent.target.hasPointerCapture(event.pointerId)) event.nativeEvent.target.releasePointerCapture(event.pointerId);
    if (controls.current) controls.current.enabled = interactionMode === "view";
  };
  const pointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    event.stopPropagation();
    const hit = intersectFloor(event);
    if (!hit) return;
    const placement = clampInstance(bounds, space, instance.rotation, hit.x * 1000 + drag.current.offsetX, hit.z * 1000 + drag.current.offsetZ);
    if (!placement.fits) return onPlacementError(placement.message);
    onPlacementError(undefined);
    onMove(placement.x, placement.z);
  };
  const pointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    drag.current = null;
    if (event.nativeEvent.target instanceof Element && event.nativeEvent.target.hasPointerCapture(event.pointerId)) event.nativeEvent.target.releasePointerCapture(event.pointerId);
    if (controls.current) controls.current.enabled = interactionMode === "view";
  };
  const groundOffset = { x: -bounds.center.x / 1000, y: (-bounds.center.y + bounds.height / 2) / 1000, z: -bounds.center.z / 1000 };
  return (
    <group
      position={[instance.position.x / 1000, 0, instance.position.z / 1000]}
      rotation={[0, THREE.MathUtils.degToRad(instance.rotation), 0]}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      <group position={[groundOffset.x, groundOffset.y, groundOffset.z]}>
        <AssetRenderer asset={asset} />
      </group>
      {selected && bounds.width > 0 && <mesh position={[0, bounds.height / 2000, 0]}><boxGeometry args={[bounds.width / 1000 + 0.02, bounds.height / 1000 + 0.02, bounds.depth / 1000 + 0.02]} /><meshBasicMaterial color="#ff6b35" wireframe transparent opacity={0.65} /></mesh>}
      {selected && interactionMode === "place" && <group>
        <Line points={[[0, bounds.height / 1000 + .04, 0], [0, bounds.height / 1000 + .28, 0]]} color="#ff6231" lineWidth={2} depthTest={false} />
        <mesh position={[0, bounds.height / 1000 + .32, 0]} onPointerDown={rotateDown} onPointerMove={rotateMove} onPointerUp={rotateUp} onPointerCancel={rotateUp}>
          <torusGeometry args={[.1, .025, 12, 32]} /><meshBasicMaterial color="#ff6231" depthTest={false} />
        </mesh>
        <Html center position={[0, bounds.height / 1000 + .48, 0]} distanceFactor={9} style={{ pointerEvents: "none" }}><span className="gizmo-label">회전 {Math.round(instance.rotation)}°</span></Html>
      </group>}
    </group>
  );
}

function SceneContents(props: Props) {
  const controls = useRef<ControlsInstance>(null);
  const width = props.space.width / 1000;
  const depth = props.space.depth / 1000;
  const height = props.space.height / 1000;
  return (
    <>
      <color attach="background" args={["#dadbd8"]} />
      <ambientLight intensity={1.3} />
      <hemisphereLight intensity={0.8} groundColor="#66655f" />
      <directionalLight position={[4, 8, 5]} intensity={2.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { event.stopPropagation(); props.onSelect(undefined); }}>
        <planeGeometry args={[width, depth]} />
        <SurfaceMaterial surface={props.space.floor} aspect={width / depth} />
      </mesh>
      {props.space.gridVisible && <CustomGrid width={props.space.width} depth={props.space.depth} />}
      {props.space.wallMode !== "none" && <mesh position={[0, height / 2, -depth / 2]}><planeGeometry args={[width, height]} /><SurfaceMaterial surface={props.space.walls.back} aspect={width / height} /></mesh>}
      {props.space.wallMode === "three" && <>
        <mesh position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[depth, height]} /><SurfaceMaterial surface={props.space.walls.left} aspect={depth / height} /></mesh>
        <mesh position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[depth, height]} /><SurfaceMaterial surface={props.space.walls.right} aspect={depth / height} /></mesh>
      </>}
      <Suspense fallback={null}>
        {props.space.instances.map((instance) => {
          const asset = props.assets.find((candidate) => candidate.id === instance.assetId);
          return asset ? <PlacedAsset key={instance.id} asset={asset} instance={instance} selected={props.selectedId === instance.id} space={props.space} controls={controls} interactionMode={props.interactionMode} onSelect={() => props.onSelect(instance.id)} onMove={(x, z) => props.onMove(instance.id, x, z)} onRotate={(rotation, x, z) => props.onRotate(instance.id, rotation, x, z)} onPlacementError={props.onPlacementError} /> : null;
        })}
      </Suspense>
      <OrbitControls ref={controls} enabled={props.interactionMode === "view"} makeDefault target={[0, height * 0.25, 0]} minDistance={1} maxDistance={40} enableDamping dampingFactor={0.08} />
    </>
  );
}

export function SpaceScene(props: Props) {
  const cameraDistance = Math.max(props.space.width, props.space.depth) / 700;
  return (
    <Canvas dpr={[1, 1.5]} shadows={false} frameloop="demand" camera={{ position: [cameraDistance, cameraDistance * 0.75, cameraDistance], fov: 46, near: 0.02, far: 200 }}>
      <SceneContents {...props} />
    </Canvas>
  );
}
