"use client";

import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react";
import * as THREE from "three";
import type { AssetNode, AssetPartNode, BendModifier, GeometrySource, NodeTransform, Vector2Mm, Vector3Mm } from "@/studio/domain/types";
import { buildGeometry } from "@/studio/geometry/buildGeometry";

type DragHandleProps = {
  position: [number, number, number];
  color: string;
  label: string;
  onDrag: (dx: number, dy: number, shiftKey: boolean) => void;
  onManipulation: (active: boolean) => void;
  size?: number;
};

function DragHandle({ position, color, label, onDrag, onManipulation, size = 0.055 }: DragHandleProps) {
  const previous = useRef<{ x: number; y: number } | null>(null);
  const previousDom = useRef<{ x: number; y: number } | null>(null);
  const onDragRef = useRef(onDrag);
  const onManipulationRef = useRef(onManipulation);
  onDragRef.current = onDrag;
  onManipulationRef.current = onManipulation;
  const down = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    previous.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    if (event.nativeEvent.target instanceof Element) event.nativeEvent.target.setPointerCapture(event.pointerId);
    onManipulation(true);
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!previous.current) return;
    event.stopPropagation();
    const current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    onDrag(current.x - previous.current.x, current.y - previous.current.y, event.nativeEvent.shiftKey);
    previous.current = current;
  };
  const up = (event: ThreeEvent<PointerEvent>) => {
    if (!previous.current) return;
    event.stopPropagation();
    previous.current = null;
    if (event.nativeEvent.target instanceof Element && event.nativeEvent.target.hasPointerCapture(event.pointerId)) event.nativeEvent.target.releasePointerCapture(event.pointerId);
    onManipulation(false);
  };
  const domWindowMove = (event: MouseEvent) => {
    if (!previousDom.current) return;
    event.preventDefault();
    onDragRef.current(event.clientX - previousDom.current.x, event.clientY - previousDom.current.y, event.shiftKey);
    previousDom.current = { x: event.clientX, y: event.clientY };
  };
  const domWindowUp = () => {
    if (!previousDom.current) return;
    previousDom.current = null;
    window.removeEventListener("mousemove", domWindowMove);
    window.removeEventListener("mouseup", domWindowUp);
    onManipulationRef.current(false);
  };
  const domDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    previousDom.current = { x: event.clientX, y: event.clientY };
    window.addEventListener("mousemove", domWindowMove);
    window.addEventListener("mouseup", domWindowUp, { once: true });
    onManipulation(true);
  };
  return (
    <group position={position}>
      <mesh onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} renderOrder={20}>
        <sphereGeometry args={[size * 2.5, 16, 10]} />
        <meshBasicMaterial transparent opacity={0.001} depthTest={false} />
      </mesh>
      <mesh renderOrder={21}>
        <sphereGeometry args={[size, 20, 14]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      <Html center position={[0, size * 1.8, 0]} distanceFactor={8} style={{ pointerEvents: "auto" }}>
        <button className="gizmo-label gizmo-handle-button" aria-label={`조절: ${label}`} onPointerDown={(event) => event.stopPropagation()} onMouseDown={domDown} onClick={(event) => event.stopPropagation()}>{label}</button>
      </Html>
    </group>
  );
}

function sourceBounds(part: AssetPartNode) {
  if (part.source.kind === "glb") return new THREE.Box3(
    new THREE.Vector3(-part.source.dimensions.width / 2000, 0, -part.source.dimensions.depth / 2000),
    new THREE.Vector3(part.source.dimensions.width / 2000, part.source.dimensions.height / 1000, part.source.dimensions.depth / 2000),
  );
  const built = buildGeometry(part.source, []);
  built.geometry.computeBoundingBox();
  const box = built.geometry.boundingBox?.clone() ?? new THREE.Box3(new THREE.Vector3(-.4, -.4, -.4), new THREE.Vector3(.4, .4, .4));
  built.geometry.dispose();
  return box;
}

export function BendGizmo({
  part,
  modifier,
  onChange,
  onManipulation,
}: {
  part: AssetPartNode;
  modifier: BendModifier;
  onChange: (patch: Partial<BendModifier>) => void;
  onManipulation: (active: boolean) => void;
}) {
  const box = useMemo(() => sourceBounds(part), [part.source]);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, .3);
  const anglePosition: [number, number, number] = [box.max.x + span * .22, center.y, center.z];
  const radiusPosition: [number, number, number] = [center.x, box.max.y + span * .22, center.z];
  const rangePosition: [number, number, number] = [box.min.x - span * .22, center.y, center.z];
  const range = modifier.range ?? 1;
  return (
    <group name="bend-gizmo">
      <Line points={[[center.x, center.y, center.z], anglePosition]} color="#ff6231" lineWidth={1.5} depthTest={false} />
      <Line points={[[center.x, center.y, center.z], radiusPosition]} color="#4788f3" lineWidth={1.5} depthTest={false} />
      <Line points={[[center.x, center.y, center.z], rangePosition]} color="#7b69de" lineWidth={1.5} depthTest={false} dashed dashSize={.03} gapSize={.02} />
      <DragHandle position={anglePosition} color="#ff6231" label={`각도 ${Math.round(modifier.angle)}°`} onManipulation={onManipulation} onDrag={(dx, dy) => onChange({ angle: THREE.MathUtils.clamp(modifier.angle + dx * .7 - dy * .2, -270, 270) })} />
      <DragHandle position={radiusPosition} color="#4788f3" label={`반경 ${Math.round(modifier.radius)}mm`} onManipulation={onManipulation} onDrag={(dx, dy) => onChange({ radius: Math.max(10, modifier.radius + dx * 3 - dy * 5) })} />
      <DragHandle position={rangePosition} color="#7b69de" label={`범위 ${Math.round(range * 100)}%`} onManipulation={onManipulation} onDrag={(dx) => onChange({ range: THREE.MathUtils.clamp(range - dx / 180, .05, 1) })} />
    </group>
  );
}

function updateBezier(source: Extract<GeometrySource, { kind: "extrude" }>, key: string, dx: number, dy: number) {
  if (source.sketch.kind !== "bezier") return source;
  const sketch = structuredClone(source.sketch);
  const move = (point: Vector2Mm) => ({ x: point.x + dx * 2, y: point.y - dy * 2 });
  if (key === "start") sketch.start = move(sketch.start);
  else {
    const [indexText, pointKey] = key.split(":");
    const index = Number(indexText);
    const curve = sketch.curves[index];
    if (pointKey === "c1") curve.control1 = move(curve.control1);
    if (pointKey === "c2") curve.control2 = move(curve.control2);
    if (pointKey === "end") curve.end = move(curve.end);
  }
  return { ...source, sketch };
}

export function CurveControlGizmo({
  part,
  onSourceChange,
  onManipulation,
}: {
  part: AssetPartNode;
  onSourceChange: (source: GeometrySource) => void;
  onManipulation: (active: boolean) => void;
}) {
  const source = part.source;
  if (source.kind === "extrude" && source.sketch.kind === "rectangle") {
    const sketch = source.sketch;
    const corner: [number, number, number] = [sketch.width / 2000, sketch.height / 2000, source.depth / 2000];
    return <DragHandle position={corner} color="#18a779" label="가로 · 세로" size={.045} onManipulation={onManipulation} onDrag={(dx, dy) => onSourceChange({ ...source, sketch: { ...sketch, width: Math.max(10, sketch.width + dx * 4), height: Math.max(10, sketch.height - dy * 4) } })} />;
  }
  if (source.kind === "extrude" && source.sketch.kind === "circle") {
    const sketch = source.sketch;
    return <DragHandle position={[sketch.radius / 1000, 0, source.depth / 2000]} color="#18a779" label="반지름" size={.045} onManipulation={onManipulation} onDrag={(dx) => onSourceChange({ ...source, sketch: { ...sketch, radius: Math.max(10, sketch.radius + dx * 2) } })} />;
  }
  if (source.kind === "extrude" && source.sketch.kind === "polygon") {
    const sketch = source.sketch;
    return <group position={[0, 0, source.depth / 2000]}>{sketch.points.map((point, index) => <DragHandle key={index} position={[point.x / 1000, point.y / 1000, 0]} color="#18a779" label={`P${index + 1}`} size={.04} onManipulation={onManipulation} onDrag={(dx, dy) => onSourceChange({ ...source, sketch: { ...sketch, points: sketch.points.map((candidate, candidateIndex) => candidateIndex === index ? { x: candidate.x + dx * 2, y: candidate.y - dy * 2 } : candidate) } })} />)}</group>;
  }
  if (source.kind === "extrude" && source.sketch.kind === "bezier") {
    const entries: Array<{ key: string; point: Vector2Mm; color: string }> = [{ key: "start", point: source.sketch.start, color: "#18a779" }];
    source.sketch.curves.forEach((curve, index) => entries.push(
      { key: `${index}:c1`, point: curve.control1, color: "#f5a623" },
      { key: `${index}:c2`, point: curve.control2, color: "#f5a623" },
      { key: `${index}:end`, point: curve.end, color: "#18a779" },
    ));
    return <group position={[0, 0, source.depth / 2000]}>{entries.map((entry) => <DragHandle key={entry.key} position={[entry.point.x / 1000, entry.point.y / 1000, 0]} color={entry.color} label={entry.key.replace(":", " ")} size={.04} onManipulation={onManipulation} onDrag={(dx, dy) => onSourceChange(updateBezier(source, entry.key, dx, dy))} />)}</group>;
  }
  if (source.kind === "sweep") {
    return <group>{source.path.points.map((point, index) => <DragHandle key={index} position={[point.x / 1000, point.y / 1000, point.z / 1000]} color="#18a779" label={`Path ${index + 1}`} size={.045} onManipulation={onManipulation} onDrag={(dx, dy, shiftKey) => {
      const points = source.path.points.map((candidate, candidateIndex): Vector3Mm => candidateIndex === index ? shiftKey
        ? { ...candidate, x: candidate.x + dx * 2, z: candidate.z - dy * 2 }
        : { ...candidate, x: candidate.x + dx * 2, y: candidate.y - dy * 2 }
        : candidate);
      onSourceChange({ ...source, path: { ...source.path, points } });
    }} />)}</group>;
  }
  if (source.kind === "revolve") {
    return <group>{source.profile.map((point, index) => <DragHandle key={index} position={[point.x / 1000, point.y / 1000, 0]} color={index === 0 || index === source.profile.length - 1 ? "#18a779" : "#f5a623"} label={`Profile ${index + 1}`} size={.04} onManipulation={onManipulation} onDrag={(dx, dy) => onSourceChange({ ...source, profile: source.profile.map((candidate, candidateIndex) => candidateIndex === index ? { x: Math.max(0, candidate.x + dx * 2), y: candidate.y - dy * 2 } : candidate) })} />)}</group>;
  }
  return null;
}

export function ObjectTransformGizmo({
  node,
  onChange,
  onManipulation,
  coordinateSpace,
}: {
  node: AssetNode;
  onChange: (transform: NodeTransform) => void;
  onManipulation: (active: boolean) => void;
  coordinateSpace: "local" | "world";
}) {
  const box = useMemo(() => node.type === "part" ? sourceBounds(node) : new THREE.Box3(new THREE.Vector3(-.25, -.25, -.25), new THREE.Vector3(.25, .25, .25)), [node.type, node.type === "part" ? node.source : null]);
  const center = box.getCenter(new THREE.Vector3());
  const size = Math.max(box.getSize(new THREE.Vector3()).length(), .4);
  const xHandle: [number, number, number] = [box.max.x + size * .14, center.y, center.z];
  const yHandle: [number, number, number] = [center.x, box.max.y + size * .14, center.z];
  const zHandle: [number, number, number] = [center.x, center.y, box.max.z + size * .14];
  const rotateHandle: [number, number, number] = [center.x, box.max.y + size * .3, center.z];
  const worldCompensation: [number, number, number] = coordinateSpace === "world" ? [
    -THREE.MathUtils.degToRad(node.transform.rotation.x),
    -THREE.MathUtils.degToRad(node.transform.rotation.y),
    -THREE.MathUtils.degToRad(node.transform.rotation.z),
  ] : [0, 0, 0];
  return <group name="object-transform-gizmo" rotation={worldCompensation}>
    <Line points={[[center.x, center.y, center.z], xHandle]} color="#e44747" lineWidth={2} depthTest={false} />
    <Line points={[[center.x, center.y, center.z], yHandle]} color="#35a76f" lineWidth={2} depthTest={false} />
    <Line points={[[center.x, center.y, center.z], zHandle]} color="#4788f3" lineWidth={2} depthTest={false} />
    <DragHandle position={xHandle} color="#e44747" label="이동 X" onManipulation={onManipulation} onDrag={(dx) => onChange({ ...node.transform, position: { ...node.transform.position, x: node.transform.position.x + dx * 2 } })} />
    <DragHandle position={yHandle} color="#35a76f" label="이동 Y" onManipulation={onManipulation} onDrag={(_, dy) => onChange({ ...node.transform, position: { ...node.transform.position, y: node.transform.position.y - dy * 2 } })} />
    <DragHandle position={zHandle} color="#4788f3" label="이동 Z" onManipulation={onManipulation} onDrag={(dx, dy) => onChange({ ...node.transform, position: { ...node.transform.position, z: node.transform.position.z + (dx - dy) * 1.4 } })} />
    <DragHandle position={rotateHandle} color="#ff6231" label={`회전 Y ${Math.round(node.transform.rotation.y)}°`} onManipulation={onManipulation} onDrag={(dx) => onChange({ ...node.transform, rotation: { ...node.transform.rotation, y: node.transform.rotation.y + dx * .7 } })} />
  </group>;
}
