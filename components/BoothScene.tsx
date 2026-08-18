"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { BoothSettings, Fixture, FloorMaterial, ViewPreset } from "@/lib/types";
import { FixtureBox } from "@/components/FixtureBox";
import { prepareModelToDimensions } from "@/lib/modelTransform";

type Props = {
  booth: BoothSettings;
  fixtures: Fixture[];
  selectedId: string | null;
  view: ViewPreset;
  snap: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
};

type ErrorBoundaryState = { failed: boolean };

class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function createFloorTexture(material: FloorMaterial, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (material === "dark-carpet" || material === "light-carpet") {
    for (let index = 0; index < 2600; index += 1) {
      const x = (index * 73) % 512;
      const y = (index * 151) % 512;
      const light = material === "dark-carpet" ? 110 + (index % 34) : 90 + (index % 38);
      context.fillStyle = `rgb(${light} ${light} ${light} / ${material === "dark-carpet" ? 0.11 : 0.08})`;
      context.fillRect(x, y, 1.2, 1.2);
    }
  } else if (material === "concrete") {
    for (let index = 0; index < 900; index += 1) {
      const x = (index * 97) % 512;
      const y = (index * 193) % 512;
      const shade = 110 + (index % 70);
      context.fillStyle = `rgb(${shade} ${shade} ${shade} / 0.08)`;
      context.beginPath();
      context.arc(x, y, 0.5 + (index % 3), 0, Math.PI * 2);
      context.fill();
    }
  } else if (material === "gray-tile" || material === "white-tile") {
    context.strokeStyle = material === "gray-tile" ? "rgb(48 53 52 / 0.32)" : "rgb(120 120 114 / 0.25)";
    context.lineWidth = 5;
    context.strokeRect(2.5, 2.5, 507, 507);
    context.strokeStyle = "rgb(255 255 255 / 0.15)";
    context.lineWidth = 2;
    context.strokeRect(8, 8, 496, 496);
  } else if (material === "wood") {
    context.strokeStyle = "rgb(73 44 24 / 0.35)";
    context.lineWidth = 4;
    [0, 128, 256, 384, 512].forEach((y) => {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(512, y);
      context.stroke();
    });
    context.strokeStyle = "rgb(255 238 211 / 0.14)";
    context.lineWidth = 2;
    for (let index = 0; index < 18; index += 1) {
      const y = 18 + (index * 29) % 490;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(120, y - 6, 360, y + 7, 512, y - 2);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function configureTexture(
  texture: THREE.Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  fitToSurface = false,
) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = fitToSurface ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.wrapT = fitToSurface ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function useSurfaceTexture({
  image,
  material,
  color,
  repeatX,
  repeatY,
}: {
  image?: string;
  material?: FloorMaterial;
  color: string;
  repeatX: number;
  repeatY: number;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());

  useEffect(() => {
    let active = true;
    let current: THREE.Texture | null = null;

    if (image) {
      new THREE.TextureLoader().load(image, (loaded) => {
        if (!active) {
          loaded.dispose();
          return;
        }
        current = configureTexture(loaded, 1, 1, anisotropy, true);
        setTexture(current);
      });
    } else if (material) {
      current = configureTexture(createFloorTexture(material, color), repeatX, repeatY, anisotropy);
      setTexture(current);
    } else {
      setTexture(null);
    }

    return () => {
      active = false;
      current?.dispose();
    };
  }, [anisotropy, color, image, material, repeatX, repeatY]);

  return texture;
}

function CameraDirector({ view, booth }: { view: ViewPreset; booth: BoothSettings }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
    | undefined;

  useEffect(() => {
    const max = Math.max(booth.width, booth.depth, booth.height) / 1000;
    const centerY = Math.min(booth.height / 1000 / 2.8, 1);

    if (view === "top") {
      camera.position.set(0.001, max * 2.1, 0.001);
      camera.up.set(0, 0, -1);
      controls?.target.set(0, 0, 0);
    } else if (view === "front") {
      camera.position.set(0, Math.max(1.4, max * 0.55), max * 2);
      camera.up.set(0, 1, 0);
      controls?.target.set(0, centerY, 0);
    } else {
      camera.position.set(max * 1.2, max * 1.05, max * 1.45);
      camera.up.set(0, 1, 0);
      controls?.target.set(0, centerY, 0);
    }

    camera.lookAt(controls?.target ?? new THREE.Vector3(0, centerY, 0));
    camera.updateProjectionMatrix();
    controls?.update();
  }, [booth, camera, controls, view]);

  return null;
}

function BoothGrid({ width, depth }: { width: number; depth: number }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const spacing = 0.5;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;

    for (let x = -halfWidth; x <= halfWidth + 0.0001; x += spacing) {
      const current = Math.min(halfWidth, x);
      points.push(current, 0, -halfDepth, current, 0, halfDepth);
    }
    if (Math.abs(width / spacing - Math.round(width / spacing)) > 0.0001) {
      points.push(halfWidth, 0, -halfDepth, halfWidth, 0, halfDepth);
    }
    for (let z = -halfDepth; z <= halfDepth + 0.0001; z += spacing) {
      const current = Math.min(halfDepth, z);
      points.push(-halfWidth, 0, current, halfWidth, 0, current);
    }
    if (Math.abs(depth / spacing - Math.round(depth / spacing)) > 0.0001) {
      points.push(-halfWidth, 0, halfDepth, halfWidth, 0, halfDepth);
    }

    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return next;
  }, [depth, width]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} position={[0, 0.006, 0]}>
      <lineBasicMaterial color="#c7b9a7" transparent opacity={0.72} />
    </lineSegments>
  );
}

function WallPanel({
  image,
  color,
  width,
  height,
  position,
  rotation,
}: {
  image?: string;
  color: string;
  width: number;
  height: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const texture = useSurfaceTexture({ image, color, repeatX: 1, repeatY: 1 });
  return (
    <mesh position={position} rotation={rotation} receiveShadow castShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={texture ? "#ffffff" : color} map={texture ?? undefined} roughness={0.86} side={THREE.DoubleSide} />
    </mesh>
  );
}

function BoothShell({ booth }: { booth: BoothSettings }) {
  const width = booth.width / 1000;
  const depth = booth.depth / 1000;
  const height = booth.height / 1000;
  const floorTexture = useSurfaceTexture({
    image: booth.floorImage,
    material: booth.floorMaterial,
    color: booth.floorColor,
    repeatX: Math.max(1, width),
    repeatY: Math.max(1, depth),
  });
  const floorSurfaceColor = floorTexture ? "#ffffff" : booth.floorColor;

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={floorSurfaceColor} map={floorTexture ?? undefined} roughness={0.82} />
      </mesh>
      {booth.showGrid && <BoothGrid width={width} depth={depth} />}
      {booth.wallMode !== "none" && (
        <WallPanel image={booth.wallImages.back} color={booth.wallColor} width={width} height={height} position={[0, height / 2, -depth / 2]} />
      )}
      {booth.wallMode === "three" && (
        <>
          <WallPanel image={booth.wallImages.left} color={booth.wallColor} width={depth} height={height} position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
          <WallPanel image={booth.wallImages.right} color={booth.wallColor} width={depth} height={height} position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]} />
        </>
      )}
    </group>
  );
}

function SelectionOutline({ fixture }: { fixture: Fixture }) {
  const width = fixture.width / 1000;
  const depth = fixture.depth / 1000;
  const height = fixture.height / 1000;
  return (
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[width + 0.035, height + 0.035, depth + 0.035]} />
      <meshBasicMaterial color="#ff6b35" transparent opacity={0.13} depthWrite={false} />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width + 0.04, height + 0.04, depth + 0.04)]} />
        <lineBasicMaterial color="#ff6b35" />
      </lineSegments>
    </mesh>
  );
}

function PrimitiveFixture({ fixture }: { fixture: Fixture }) {
  const w = fixture.width / 1000;
  const d = fixture.depth / 1000;
  const h = fixture.height / 1000;
  const material = <meshStandardMaterial color={fixture.color} roughness={0.58} metalness={0.03} />;

  if (fixture.category === "table") {
    const leg = Math.max(0.035, Math.min(w, d) * 0.08);
    return (
      <group>
        <mesh position={[0, h - 0.055, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.11, d]} />
          {material}
        </mesh>
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <mesh key={`${x}-${z}`} position={[x * (w / 2 - leg), (h - 0.11) / 2, z * (d / 2 - leg)]} castShadow>
              <boxGeometry args={[leg, h - 0.11, leg]} />
              {material}
            </mesh>
          )),
        )}
      </group>
    );
  }

  if (fixture.category === "chair" || fixture.category === "stool") {
    const seatY = fixture.category === "chair" ? Math.min(h * 0.55, 0.46) : h - Math.max(0.06, h * 0.12);
    const leg = Math.max(0.025, Math.min(w, d) * 0.075);
    return (
      <group>
        <mesh position={[0, seatY, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, Math.max(0.06, h * 0.1), d]} />
          {material}
        </mesh>
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <mesh key={`${x}-${z}`} position={[x * (w / 2 - leg), seatY / 2, z * (d / 2 - leg)]} castShadow>
              <boxGeometry args={[leg, seatY, leg]} />
              {material}
            </mesh>
          )),
        )}
        {fixture.category === "chair" && (
          <mesh position={[0, seatY + (h - seatY) / 2, -d / 2 + Math.max(0.035, d * 0.07) / 2]} castShadow>
            <boxGeometry args={[w, h - seatY, Math.max(0.035, d * 0.07)]} />
            {material}
          </mesh>
        )}
      </group>
    );
  }

  if (fixture.category === "sofa") {
    const armWidth = Math.max(0.08, w * 0.1);
    const seatHeight = h * 0.42;
    return (
      <group>
        <mesh position={[0, seatHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, seatHeight, d * 0.82]} />
          {material}
        </mesh>
        <mesh position={[0, seatHeight + (h - seatHeight) / 2, -d / 2 + d * 0.12]} castShadow>
          <boxGeometry args={[w, h - seatHeight, d * 0.24]} />
          {material}
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * (w / 2 - armWidth / 2), seatHeight * 0.88, 0]} castShadow>
            <boxGeometry args={[armWidth, seatHeight * 0.75, d]} />
            {material}
          </mesh>
        ))}
      </group>
    );
  }

  if (fixture.category === "showcase") {
    const baseHeight = h * 0.34;
    return (
      <group>
        <mesh position={[0, baseHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, baseHeight, d]} />
          {material}
        </mesh>
        <mesh position={[0, baseHeight + (h - baseHeight) / 2, 0]} castShadow>
          <boxGeometry args={[w * 0.96, h - baseHeight, d * 0.96]} />
          <meshPhysicalMaterial color="#dbe9e7" transparent opacity={0.34} roughness={0.08} metalness={0.05} transmission={0.25} />
        </mesh>
      </group>
    );
  }

  if (fixture.category === "rack") {
    const pole = Math.max(0.025, Math.min(w, d) * 0.055);
    return (
      <group>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * (w / 2 - pole), h / 2, 0]} castShadow>
            <boxGeometry args={[pole, h, pole]} />
            <meshStandardMaterial color={fixture.color} metalness={0.5} roughness={0.32} />
          </mesh>
        ))}
        <mesh position={[0, h - pole, 0]} castShadow>
          <boxGeometry args={[w, pole, pole]} />
          <meshStandardMaterial color={fixture.color} metalness={0.5} roughness={0.32} />
        </mesh>
        <mesh position={[0, pole / 2, 0]} receiveShadow>
          <boxGeometry args={[w, pole, d]} />
          {material}
        </mesh>
      </group>
    );
  }

  if (fixture.category === "partition") {
    const footHeight = Math.min(0.08, h * 0.08);
    return (
      <group>
        <mesh position={[0, h / 2 + footHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h - footHeight, d]} />
          {material}
        </mesh>
        <mesh position={[0, footHeight / 2, 0]} receiveShadow>
          <boxGeometry args={[w * 0.65, footHeight, d]} />
          <meshStandardMaterial color="#444947" roughness={0.68} />
        </mesh>
      </group>
    );
  }

  if (fixture.category === "plinth") {
    const capHeight = Math.min(0.024, h * 0.08);
    return (
      <group>
        <mesh position={[0, (h - capHeight) / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h - capHeight, d]} />
          {material}
        </mesh>
        <mesh position={[0, h - capHeight / 2, 0]} castShadow>
          <boxGeometry args={[w, capHeight, d]} />
          <meshStandardMaterial color={fixture.color} roughness={0.4} />
        </mesh>
      </group>
    );
  }

  if (fixture.category === "banner") {
    return (
      <group>
        <mesh position={[0, h / 2 + 0.03, 0]} castShadow>
          <boxGeometry args={[w, Math.max(0.1, h - 0.12), Math.min(d, 0.07)]} />
          {material}
        </mesh>
        <mesh position={[0, 0.035, 0]} receiveShadow>
          <boxGeometry args={[Math.min(w, 0.45), 0.07, d]} />
          <meshStandardMaterial color="#3a3530" roughness={0.7} />
        </mesh>
      </group>
    );
  }

  if (fixture.category === "shelf" || fixture.category === "display") {
    const side = Math.max(0.035, w * 0.045);
    const shelf = Math.max(0.028, h * 0.025);
    const levels = fixture.category === "shelf" ? 4 : 3;
    return (
      <group>
        <mesh position={[-w / 2 + side / 2, h / 2, 0]} castShadow>{<boxGeometry args={[side, h, d]} />}{material}</mesh>
        <mesh position={[w / 2 - side / 2, h / 2, 0]} castShadow>{<boxGeometry args={[side, h, d]} />}{material}</mesh>
        {Array.from({ length: levels }).map((_, index) => {
          const y = shelf / 2 + (index * (h - shelf)) / (levels - 1);
          return <mesh key={index} position={[0, y, 0]} castShadow receiveShadow>{<boxGeometry args={[w, shelf, d]} />}{material}</mesh>;
        })}
        {fixture.category === "display" && (
          <mesh position={[0, h / 2, -d / 2 + side / 2]} receiveShadow>
            <boxGeometry args={[w, h, side]} />
            <meshStandardMaterial color={fixture.color} roughness={0.72} />
          </mesh>
        )}
      </group>
    );
  }

  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      {material}
    </mesh>
  );
}

function GlbFixture({ fixture }: { fixture: Fixture }) {
  const gltf = useGLTF(fixture.modelUrl!);
  const prepared = useMemo(
    () => prepareModelToDimensions(
      gltf.scene,
      { width: fixture.width, depth: fixture.depth, height: fixture.height },
      fixture.modelRotation ?? { x: 0, y: 0, z: 0 },
    ),
    [fixture.depth, fixture.height, fixture.modelRotation?.x, fixture.modelRotation?.y, fixture.modelRotation?.z, fixture.width, gltf.scene],
  );

  return <primitive object={prepared.object} />;
}

function FixtureObject({
  fixture,
  booth,
  selected,
  snap,
  onSelect,
  onMove,
  onDragging,
}: {
  fixture: Fixture;
  booth: BoothSettings;
  selected: boolean;
  snap: number;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, z: number) => void;
  onDragging: (dragging: boolean) => void;
}) {
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const intersection = useMemo(() => new THREE.Vector3(), []);
  const dragOffset = useMemo(() => new THREE.Vector3(), []);
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null;

  useEffect(() => () => {
    if (controls) controls.enabled = true;
  }, [controls]);

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (!event.ray.intersectPlane(dragPlane, intersection)) return;
    dragging.current = true;
    pointerId.current = event.pointerId;
    dragOffset.set(fixture.x / 1000 - intersection.x, 0, fixture.z / 1000 - intersection.z);
    if (controls) controls.enabled = false;
    onDragging(true);
    const target = event.target as (EventTarget & { setPointerCapture?: (id: number) => void }) | null;
    target?.setPointerCapture?.(event.pointerId);
    onSelect(fixture.id);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!dragging.current) return;
    event.stopPropagation();
    if (!event.ray.intersectPlane(dragPlane, intersection)) return;

    const snapMeters = Math.max(10, snap) / 1000;
    const radians = (fixture.rotation * Math.PI) / 180;
    const halfX = (Math.abs(Math.cos(radians)) * fixture.width + Math.abs(Math.sin(radians)) * fixture.depth) / 2000;
    const halfZ = (Math.abs(Math.sin(radians)) * fixture.width + Math.abs(Math.cos(radians)) * fixture.depth) / 2000;
    const maxX = Math.max(0, booth.width / 2000 - halfX);
    const maxZ = Math.max(0, booth.depth / 2000 - halfZ);
    const desiredX = intersection.x + dragOffset.x;
    const desiredZ = intersection.z + dragOffset.z;
    const x = THREE.MathUtils.clamp(Math.round(desiredX / snapMeters) * snapMeters, -maxX, maxX);
    const z = THREE.MathUtils.clamp(Math.round(desiredZ / snapMeters) * snapMeters, -maxZ, maxZ);
    onMove(fixture.id, Math.round(x * 1000), Math.round(z * 1000));
  }

  function stopDragging(event: ThreeEvent<PointerEvent>) {
    const target = event.target as (EventTarget & { releasePointerCapture?: (id: number) => void }) | null;
    if (pointerId.current !== null) target?.releasePointerCapture?.(pointerId.current);
    dragging.current = false;
    pointerId.current = null;
    if (controls) controls.enabled = true;
    onDragging(false);
  }

  const fallback = <PrimitiveFixture fixture={fixture} />;
  const localFixture = fixture.source === "photo" ? <FixtureBox fixture={fixture} /> : fallback;

  return (
    <group
      position={[fixture.x / 1000, 0.012, fixture.z / 1000]}
      rotation-y={(fixture.rotation * Math.PI) / 180}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(fixture.id);
      }}
    >
      {fixture.modelUrl ? (
        <ModelErrorBoundary fallback={fallback}>
          <Suspense fallback={<LoadingModel fixture={fixture} />}>
            <GlbFixture fixture={fixture} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        localFixture
      )}
      {selected && <SelectionOutline fixture={fixture} />}
    </group>
  );
}

function LoadingModel({ fixture }: { fixture: Fixture }) {
  return (
    <group>
      <PrimitiveFixture fixture={{ ...fixture, color: "#d9d2c7" }} />
      <Html position={[0, fixture.height / 1000 + 0.2, 0]} center>
        <div className="model-loading">GLB 불러오는 중…</div>
      </Html>
    </group>
  );
}

function Stage(props: Props) {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <>
      <color attach="background" args={["#eee9e1"]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[4, 7, 5]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-3, 4, -2]} intensity={0.55} color="#b7ceff" />
      <BoothShell booth={props.booth} />
      {props.fixtures.map((fixture) => (
        <FixtureObject
          key={fixture.id}
          fixture={fixture}
          booth={props.booth}
          selected={fixture.id === props.selectedId}
          snap={props.snap}
          onSelect={props.onSelect}
          onMove={props.onMove}
          onDragging={setIsDragging}
        />
      ))}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.22} scale={10} blur={2.5} far={4} />
      <OrbitControls makeDefault enabled={!isDragging} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.01} />
      <CameraDirector booth={props.booth} view={props.view} />
    </>
  );
}

export function BoothScene(props: Props) {
  return (
    <Canvas
      shadows="basic"
      camera={{ fov: 42, near: 0.01, far: 100, position: [4, 3.5, 5] }}
      dpr={[1.5, 2.5]}
      gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <Stage {...props} />
    </Canvas>
  );
}
