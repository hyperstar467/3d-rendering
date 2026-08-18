"use client";

import { Edges } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { MappedStandardMaterial } from "@/components/MappedStandardMaterial";
import { MeasuredGlb } from "@/components/MeasuredGlb";
import { BendGizmo, CurveControlGizmo, ObjectTransformGizmo } from "@/components/studio/DirectManipulationGizmos";
import { useMappedTexture } from "@/components/useMappedTexture";
import type { AssetDefinition, AssetNode, BendModifier, GeometrySource, MaterialStyle, NodeTransform } from "@/studio/domain/types";
import { isDescendant, isEditLocked, isTransformLocked, pivotOffset, worldTransform } from "@/studio/domain/hierarchy";
import { buildGeometry, materialRegionAspect } from "@/studio/geometry/buildGeometry";

type Props = {
  asset: AssetDefinition;
  selectedIds?: string[];
  onSelect?: (nodeId: string, additive: boolean) => void;
  onSourceChange?: (nodeId: string, source: GeometrySource) => void;
  onBendChange?: (nodeId: string, modifierId: string, patch: Partial<BendModifier>) => void;
  onManipulation?: (active: boolean) => void;
  interactionMode?: "view" | "place" | "geometry";
  onTransformChange?: (nodeId: string, transform: NodeTransform) => void;
  isolateIds?: string[];
  coordinateSpace?: "local" | "world";
  materialPreview?: { nodeId: string; regionId: string; image: string };
};

function MaterialSlot({ material, index, aspect }: { material: MaterialStyle; index: number; aspect: number }) {
  const texture = useMappedTexture(material.image.image, material.image, aspect);
  const color = useMemo(() => new THREE.Color(material.color), [material.color]);
  return (
    <MappedStandardMaterial
      attach={`material-${index}`}
      color={color}
      texture={texture}
      programNamespace="hustle-asset-material-image"
      roughness={material.roughness}
      metalness={material.metalness}
      transparent={material.opacity < 1}
      opacity={material.opacity}
      side={THREE.DoubleSide}
    />
  );
}

function RenderNode({ asset, node, selectedIds = [], onSelect, onSourceChange, onBendChange, onManipulation = () => undefined, interactionMode = "view", onTransformChange, isolateIds = [], coordinateSpace = "local", materialPreview }: Props & { node: AssetNode }) {
  const children = asset.nodes.filter((candidate) => candidate.parentId === node.id);
  const source = node.type === "part" ? node.source : null;
  const modifiers = node.type === "part" ? node.modifiers : null;
  const built = useMemo(
    () => source && source.kind !== "glb" ? buildGeometry(source, modifiers ?? []) : null,
    [modifiers, source],
  );
  useEffect(() => () => built?.geometry.dispose(), [built]);

  const includedByIsolate = isolateIds.length === 0 || isolateIds.some((targetId) => targetId === node.id || isDescendant(targetId, node.id, asset.nodes) || isDescendant(node.id, targetId, asset.nodes));
  if ((!node.visible && isolateIds.length === 0) || !includedByIsolate) return null;

  const transform = node.transform;
  const gizmoNode = coordinateSpace === "world" ? { ...node, transform: worldTransform(node.id, asset.nodes) ?? node.transform } : node;
  const pivot = pivotOffset(node);
  const groupProps = {
    position: [transform.position.x / 1000, transform.position.y / 1000, transform.position.z / 1000] as [number, number, number],
    rotation: [
      THREE.MathUtils.degToRad(transform.rotation.x),
      THREE.MathUtils.degToRad(transform.rotation.y),
      THREE.MathUtils.degToRad(transform.rotation.z),
    ] as [number, number, number],
    scale: [transform.scale.x, transform.scale.y, transform.scale.z] as [number, number, number],
  };

  return (
    <group {...groupProps} name={node.name}>
      <group position={[-pivot.x / 1000, -pivot.y / 1000, -pivot.z / 1000]}>
      {node.type === "part" && node.source.kind === "glb" ? (
        <group
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(node.id, event.nativeEvent.shiftKey || event.nativeEvent.metaKey || event.nativeEvent.ctrlKey);
          }}
        >
          <MeasuredGlb
            modelUrl={node.source.dataUrl}
            width={node.source.dimensions.width}
            depth={node.source.dimensions.depth}
            height={node.source.dimensions.height}
            rotation={node.source.orientation}
            materialMode={node.source.materialMode ?? "original"}
            material={materialPreview?.nodeId === node.id ? { ...node.material, image: { ...node.material.image, image: materialPreview.image } } : node.material}
          />
        </group>
      ) : node.type === "part" && built ? (
        <mesh
          geometry={built.geometry}
          castShadow
          receiveShadow
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(node.id, event.nativeEvent.shiftKey || event.nativeEvent.metaKey || event.nativeEvent.ctrlKey);
          }}
        >
          {built.regions.map((region, index) => {
            const hasRegionOverride = Boolean(node.regionMaterials[region.id]);
            const material = node.regionMaterials[region.id] ?? node.material;
            const previewApplies = materialPreview?.nodeId === node.id && (materialPreview.regionId === region.id || materialPreview.regionId === "default" && !hasRegionOverride);
            return <MaterialSlot key={region.id} index={index} aspect={materialRegionAspect(node.source, region.id)} material={previewApplies ? { ...material, image: { ...material.image, image: materialPreview.image } } : material} />;
          })}
          {selectedIds.includes(node.id) && <Edges color="#ff6b35" threshold={10} />}
        </mesh>
      ) : null}
      {selectedIds.at(-1) === node.id && interactionMode === "place" && !isTransformLocked(node.id, asset.nodes) && <ObjectTransformGizmo node={gizmoNode} coordinateSpace={coordinateSpace} onChange={(transform) => onTransformChange?.(node.id, transform)} onManipulation={onManipulation} />}
      {node.type === "part" && selectedIds.length === 1 && selectedIds[0] === node.id && node.source.kind !== "glb" && interactionMode === "geometry" && !isEditLocked(node.id, asset.nodes) && (
        <>
          <CurveControlGizmo part={node} onSourceChange={(next) => onSourceChange?.(node.id, next)} onManipulation={onManipulation} />
          {node.modifiers.filter((modifier) => modifier.kind === "bend" && modifier.enabled).slice(-1).map((modifier) => (
            <BendGizmo key={modifier.id} part={node} modifier={modifier} onChange={(patch) => onBendChange?.(node.id, modifier.id, patch)} onManipulation={onManipulation} />
          ))}
        </>
      )}
      {children.map((child) => (
        <RenderNode key={child.id} asset={asset} node={child} selectedIds={selectedIds} onSelect={onSelect} onSourceChange={onSourceChange} onBendChange={onBendChange} onManipulation={onManipulation} interactionMode={interactionMode} onTransformChange={onTransformChange} isolateIds={isolateIds} coordinateSpace={coordinateSpace} materialPreview={materialPreview} />
      ))}
      </group>
    </group>
  );
}

export function AssetRenderer(props: Props) {
  return (
    <group>
      {props.asset.nodes.filter((node) => node.parentId === null).map((node) => (
        <RenderNode key={node.id} {...props} node={node} />
      ))}
    </group>
  );
}
