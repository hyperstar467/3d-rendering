"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  Box,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Cylinder,
  FolderUp,
  Group,
  Eye,
  EyeOff,
  Focus,
  Lock,
  Move3d,
  PenTool,
  Redo2,
  Save,
  Search,
  Trash2,
  Undo2,
  Ungroup,
  Unlock,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import * as THREE from "three";
import { DraftNumberInput } from "@/components/DraftNumberInput";
import { AssetScene } from "@/components/studio/AssetScene";
import { useHistory } from "@/studio/commands/useHistory";
import { createId, createMaterial, createPart, normalizeAsset } from "@/studio/domain/defaults";
import { ancestorsOf, descendantsOf, isEditLocked, isTransformLocked, reparentKeepingWorld, selectionPath, setWorldTransform, worldTransform } from "@/studio/domain/hierarchy";
import type {
  AssetDefinition,
  AssetGroupNode,
  AssetNode,
  AssetPartNode,
  CrossSection,
  GeometrySource,
  MaterialStyle,
  SketchDefinition,
  Vector2Mm,
  Vector3Mm,
  BendModifier,
  NodeTransform,
} from "@/studio/domain/types";
import { geometryRegions } from "@/studio/geometry/buildGeometry";
import { getAssetBounds, getSelectionBounds } from "@/studio/geometry/bounds";
import { t } from "@/studio/i18n/ko";

type Props = {
  initialAsset: AssetDefinition;
  onBack: () => void;
  onSave: (asset: AssetDefinition) => void;
  onAddToSpace: (asset: AssetDefinition) => void;
};

type NumberFieldProps = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
  disabled?: boolean;
};

function NumberField({ label, value, onCommit, suffix = "mm", min, step = 1, disabled }: NumberFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="number-wrap">
        <DraftNumberInput value={value} onCommit={onCommit} min={min} step={step} disabled={disabled} />
        <small>{suffix}</small>
      </span>
    </label>
  );
}

function PointsField<T extends Vector2Mm | Vector3Mm>({
  label,
  value,
  dimensions,
  onCommit,
}: {
  label: string;
  value: T[];
  dimensions: 2 | 3;
  onCommit: (points: T[]) => void;
}) {
  const serialized = value.map((point) => dimensions === 2
    ? `${point.x}, ${point.y}`
    : `${point.x}, ${point.y}, ${(point as Vector3Mm).z}`).join("; ");
  const [draft, setDraft] = useState(serialized);
  useEffect(() => setDraft(serialized), [serialized]);
  const commit = () => {
    const points = draft.split(";").map((entry) => entry.split(",").map(Number)).filter((values) => (
      values.length === dimensions && values.every(Number.isFinite)
    )).map((values) => dimensions === 2
      ? { x: values[0], y: values[1] }
      : { x: values[0], y: values[1], z: values[2] }) as T[];
    if (points.length >= (dimensions === 2 ? 3 : 2)) onCommit(points);
    else setDraft(serialized);
  };
  return (
    <label className="field field-stack">
      <span>{label}</span>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <small>{dimensions === 2 ? "x, y; x, y …" : "x, y, z; x, y, z …"}</small>
    </label>
  );
}

const DEFAULT_SOURCES: Array<{ label: string; icon: typeof Box; source: GeometrySource; color: string }> = [
  { label: "Box", icon: Box, color: "#ff6b35", source: { kind: "primitive", primitive: "box", width: 800, height: 500, depth: 400 } },
  { label: "Cylinder", icon: Cylinder, color: "#3f80ff", source: { kind: "primitive", primitive: "cylinder", radius: 250, height: 500, segments: 48 } },
  { label: "Sphere", icon: Circle, color: "#8c63e8", source: { kind: "primitive", primitive: "sphere", radius: 300, segments: 48 } },
  { label: "Cone", icon: Move3d, color: "#36a27e", source: { kind: "primitive", primitive: "cone", radius: 260, height: 600, segments: 48 } },
  { label: "Rod", icon: Waves, color: "#d95576", source: { kind: "primitive", primitive: "rod", radius: 45, length: 1000, segments: 32 } },
  { label: "Bar", icon: Move3d, color: "#76624d", source: { kind: "primitive", primitive: "bar", width: 90, height: 90, length: 1000 } },
];

const TOOL_SOURCES: Array<{ label: string; description: string; source: GeometrySource }> = [
  {
    label: "Sketch → Extrude",
    description: "닫힌 2D 외곽선에 두께를 줍니다.",
    source: { kind: "extrude", depth: 120, sketch: { kind: "polygon", points: [{ x: -400, y: -250 }, { x: 420, y: -200 }, { x: 300, y: 300 }, { x: -330, y: 360 }] } },
  },
  {
    label: "Path → Sweep",
    description: "곡선 경로를 따라 단면을 생성합니다.",
    source: {
      kind: "sweep",
      path: { curve: "catmull-rom", closed: false, points: [{ x: -650, y: 0, z: 0 }, { x: -250, y: 380, z: 100 }, { x: 250, y: 420, z: -100 }, { x: 650, y: 0, z: 0 }] },
      crossSection: { kind: "circle", radius: 45, segments: 24 },
    },
  },
  {
    label: "Profile → Revolve",
    description: "2D 프로파일을 축 주위로 회전합니다.",
    source: { kind: "revolve", angle: 360, segments: 64, profile: [{ x: 0, y: -250 }, { x: 220, y: -250 }, { x: 280, y: -160 }, { x: 240, y: 160 }, { x: 120, y: 260 }, { x: 0, y: 260 }] },
  },
];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽을 수 없습니다.`));
    reader.readAsDataURL(file);
  });
}

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
}

function cloneSubtree(asset: AssetDefinition, rootIds: string[]) {
  const descendants = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    asset.nodes.forEach((node) => {
      if (node.parentId && descendants.has(node.parentId) && !descendants.has(node.id)) {
        descendants.add(node.id);
        changed = true;
      }
    });
  }
  const idMap = new Map([...descendants].map((id) => [id, createId("node")]));
  return asset.nodes.filter((node) => descendants.has(node.id)).map((node) => {
    const clone = structuredClone(node);
    clone.id = idMap.get(node.id)!;
    clone.name = `${node.name} 복사본`;
    clone.parentId = node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId)! : node.parentId;
    if (rootIds.includes(node.id)) clone.transform.position.x += 120;
    return clone;
  });
}

function selectionRoots(ids: string[], nodes: AssetNode[]) {
  return ids.filter((id) => !ids.some((otherId) => otherId !== id && ancestorsOf(id, nodes).some((ancestor) => ancestor.id === otherId)));
}

function HierarchyRow({
  node,
  depth,
  selected,
  expanded,
  effectiveEditLock,
  onSelect,
  onExpand,
  onRename,
  onVisibility,
  onLock,
  onReparent,
}: {
  node: AssetNode;
  depth: number;
  selected: boolean;
  expanded: boolean;
  effectiveEditLock: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onExpand: () => void;
  onRename: (name: string) => void;
  onVisibility: () => void;
  onLock: (kind: "transform" | "edit") => void;
  onReparent: (nodeId: string, parentId: string | null) => void;
}) {
  const drop = (event: DragEvent) => {
    event.preventDefault();
    const nodeId = event.dataTransfer.getData("text/hustle-node-id");
    if (node.type === "group" && nodeId) onReparent(nodeId, node.id);
  };
  const inheritedEditLock = effectiveEditLock && !node.locks.edit;
  return (
    <div
      className={`tree-row ${selected ? "selected" : ""}`}
      style={{ paddingLeft: 12 + depth * 18 }}
      draggable={!effectiveEditLock}
      onDragStart={(event) => { event.dataTransfer.setData("text/hustle-node-id", node.id); event.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(event) => { if (node.type === "group") event.preventDefault(); }}
      onDrop={drop}
    >
      <button className="tree-expand" aria-label={expanded ? "접기" : "펼치기"} onClick={onExpand} disabled={node.type !== "group"}>{node.type === "group" ? expanded ? <ChevronDown /> : <ChevronRight /> : <span>◆</span>}</button>
      {selected ? <input className="tree-name-input" value={node.name} disabled={effectiveEditLock} onChange={(event) => onRename(event.currentTarget.value)} onClick={(event) => event.stopPropagation()} /> : <button className="tree-select" onClick={(event) => onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)}>{node.name}</button>}
      <span className="tree-actions">
        <button title={node.visible ? "숨기기" : "표시"} onClick={onVisibility}>{node.visible ? <Eye /> : <EyeOff />}</button>
        <button disabled={effectiveEditLock} className={node.locks?.transform ? "active-lock" : ""} title="위치 잠금" onClick={() => onLock("transform")}>{node.locks?.transform ? <Lock /> : <Unlock />}</button>
        <button disabled={inheritedEditLock} className={effectiveEditLock ? "active-lock edit" : ""} title={inheritedEditLock ? "상위 Group 편집 잠금" : "편집 잠금"} onClick={() => onLock("edit")}>{effectiveEditLock ? "E" : "e"}</button>
      </span>
    </div>
  );
}

function Hierarchy({ asset, selectedIds, search, collapsed, onSelect, onExpand, onRename, onVisibility, onLock, onReparent }: {
  asset: AssetDefinition;
  selectedIds: string[];
  search: string;
  collapsed: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onExpand: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onVisibility: (id: string) => void;
  onLock: (id: string, kind: "transform" | "edit") => void;
  onReparent: (nodeId: string, parentId: string | null) => void;
}) {
  const rows: Array<{ node: AssetNode; depth: number }> = [];
  const needle = search.trim().toLocaleLowerCase("ko");
  const visibleIds = new Set<string>();
  if (needle) asset.nodes.filter((node) => node.name.toLocaleLowerCase("ko").includes(needle)).forEach((node) => {
    visibleIds.add(node.id);
    ancestorsOf(node.id, asset.nodes).forEach((ancestor) => visibleIds.add(ancestor.id));
  });
  const visit = (parentId: string | null, depth: number) => asset.nodes.filter((node) => node.parentId === parentId).forEach((node) => {
    if (needle && !visibleIds.has(node.id)) return;
    rows.push({ node, depth });
    if (!collapsed.has(node.id) || needle) visit(node.id, depth + 1);
  });
  visit(null, 0);
  return <div className="tree" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const nodeId = event.dataTransfer.getData("text/hustle-node-id"); if (nodeId && event.target === event.currentTarget) onReparent(nodeId, null); }}>{rows.map(({ node, depth }) => <HierarchyRow key={node.id} node={node} depth={depth} selected={selectedIds.includes(node.id)} expanded={!collapsed.has(node.id)} effectiveEditLock={isEditLocked(node.id, asset.nodes)} onSelect={onSelect} onExpand={() => onExpand(node.id)} onRename={(name) => onRename(node.id, name)} onVisibility={() => onVisibility(node.id)} onLock={(kind) => onLock(node.id, kind)} onReparent={onReparent} />)}</div>;
}

function MaterialEditor({
  material,
  onChange,
  onPreviewImageChange,
}: {
  material: MaterialStyle;
  onChange: (material: MaterialStyle) => void;
  onPreviewImageChange: (image?: string) => void;
}) {
  const latestMaterial = useRef(material);
  const objectUrl = useRef<string | undefined>(undefined);
  const previewCallback = useRef(onPreviewImageChange);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  latestMaterial.current = material;
  previewCallback.current = onPreviewImageChange;
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    previewCallback.current(undefined);
  }, []);
  const chooseImage = async (file: File) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const previewUrl = URL.createObjectURL(file);
    objectUrl.current = previewUrl;
    setLoading(true);
    setUploadError(undefined);
    onPreviewImageChange(previewUrl);
    try {
      const image = await readFileAsDataUrl(file);
      onChange({ ...latestMaterial.current, image: { ...latestMaterial.current.image, image, imageName: file.name } });
      onPreviewImageChange(undefined);
    } catch (error) {
      onPreviewImageChange(undefined);
      setUploadError(error instanceof Error ? error.message : "이미지를 읽지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="property-stack">
      <label className="field color-field">
        <span>색상</span>
        <input type="color" value={material.color} onInput={(event) => onChange({ ...material, color: event.currentTarget.value })} />
      </label>
      <label className="field field-stack">
        <span>거칠기 <strong>{material.roughness.toFixed(2)}</strong></span>
        <input type="range" min="0" max="1" step="0.01" value={material.roughness} onInput={(event) => onChange({ ...material, roughness: Number(event.currentTarget.value) })} />
      </label>
      <label className="field field-stack">
        <span>금속성 <strong>{material.metalness.toFixed(2)}</strong></span>
        <input type="range" min="0" max="1" step="0.01" value={material.metalness} onInput={(event) => onChange({ ...material, metalness: Number(event.currentTarget.value) })} />
      </label>
      <label className="field field-stack">
        <span>불투명도 <strong>{material.opacity.toFixed(2)}</strong></span>
        <input type="range" min="0.05" max="1" step="0.01" value={material.opacity} onInput={(event) => onChange({ ...material, opacity: Number(event.currentTarget.value) })} />
      </label>
      <label className="upload-button compact">
        <FolderUp size={15} /> {loading ? "이미지 적용 중…" : "이미지 선택"}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void chooseImage(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {uploadError && <p className="hint danger">{uploadError}</p>}
      {material.image.image && (
        <>
          <p className="hint">이미지는 원본 색상으로 표시됩니다. 색상은 contain 여백과 이미지 밖 기본 재질에 사용됩니다.</p>
          <div className="segmented">
            {(["contain", "cover"] as const).map((fit) => (
              <button key={fit} className={material.image.fit === fit ? "active" : ""} onClick={() => onChange({ ...material, image: { ...material.image, fit } })}>{fit === "contain" ? "맞춤" : "채우기"}</button>
            ))}
          </div>
          <label className="field field-stack"><span>이미지 확대 {material.image.zoom.toFixed(2)}×</span><input type="range" min="0.25" max="4" step="0.01" value={material.image.zoom} onInput={(event) => onChange({ ...material, image: { ...material.image, zoom: Number(event.currentTarget.value) } })} /></label>
          <label className="field field-stack"><span>이미지 X {material.image.x}%</span><input type="range" min="-100" max="100" value={material.image.x} onInput={(event) => onChange({ ...material, image: { ...material.image, x: Number(event.currentTarget.value) } })} /></label>
          <label className="field field-stack"><span>이미지 Y {material.image.y}%</span><input type="range" min="-100" max="100" value={material.image.y} onInput={(event) => onChange({ ...material, image: { ...material.image, y: Number(event.currentTarget.value) } })} /></label>
          <NumberField label="이미지 회전" value={material.image.rotation} suffix="°" onCommit={(rotation) => onChange({ ...material, image: { ...material.image, rotation } })} />
          <button className="text-button danger" onClick={() => { onPreviewImageChange(undefined); onChange({ ...material, image: { ...material.image, image: undefined, imageName: undefined } }); }}>이미지 제거</button>
        </>
      )}
    </div>
  );
}

function GeometryEditor({ part, update }: { part: AssetPartNode; update: (part: AssetPartNode) => void }) {
  const source = part.source;
  const setSource = (next: GeometrySource) => update({ ...part, source: next });
  const dimensionLabel = (key: "width" | "depth" | "height" | "length") => key === "width" ? "W" : key === "depth" ? "D" : key === "height" ? "H" : "길이";
  if (source.kind === "glb") {
    return (
      <div className="property-grid three">
        {(["width", "depth", "height"] as const).map((key) => <NumberField key={key} label={dimensionLabel(key)} value={source.dimensions[key]} min={1} onCommit={(value) => setSource({ ...source, dimensions: { ...source.dimensions, [key]: value } })} />)}
        {(["x", "y", "z"] as const).map((key) => <NumberField key={key} label={`방향 ${key.toUpperCase()}`} value={source.orientation[key]} suffix="°" onCommit={(value) => setSource({ ...source, orientation: { ...source.orientation, [key]: value } })} />)}
      </div>
    );
  }
  if (source.kind === "primitive") {
    if (source.primitive === "box") return <div className="property-grid three">{(["width", "depth", "height"] as const).map((key) => <NumberField key={key} label={dimensionLabel(key)} value={source[key]} min={1} onCommit={(value) => setSource({ ...source, [key]: value })} />)}</div>;
    if (source.primitive === "bar") return <div className="property-grid three">{(["width", "height", "length"] as const).map((key) => <NumberField key={key} label={dimensionLabel(key)} value={source[key]} min={1} onCommit={(value) => setSource({ ...source, [key]: value })} />)}</div>;
    if (source.primitive === "sphere") return <div className="property-grid"><NumberField label="반지름" value={source.radius} min={1} onCommit={(radius) => setSource({ ...source, radius })} /></div>;
    return <div className="property-grid"><NumberField label="반지름" value={source.radius} min={1} onCommit={(radius) => setSource({ ...source, radius })} /><NumberField label="길이" value={source.primitive === "rod" ? source.length : source.height} min={1} onCommit={(value) => setSource(source.primitive === "rod" ? { ...source, length: value } : { ...source, height: value })} /></div>;
  }
  if (source.kind === "extrude") {
    return (
      <div className="property-stack">
        <NumberField label="Extrude 깊이" value={source.depth} min={1} onCommit={(depth) => setSource({ ...source, depth })} />
        <label className="field"><span>2D Shape</span><select value={source.sketch.kind} onChange={(event) => {
          const kind = event.currentTarget.value;
          const sketch = kind === "rectangle" ? { kind: "rectangle" as const, width: 800, height: 500 }
            : kind === "circle" ? { kind: "circle" as const, radius: 300, segments: 48 }
              : kind === "bezier" ? { kind: "bezier" as const, start: { x: -400, y: 0 }, curves: [{ control1: { x: -200, y: 400 }, control2: { x: 200, y: 400 }, end: { x: 400, y: 0 } }, { control1: { x: 200, y: -400 }, control2: { x: -200, y: -400 }, end: { x: -400, y: 0 } }] }
                : { kind: "polygon" as const, points: [{ x: -400, y: -250 }, { x: 400, y: -250 }, { x: 350, y: 300 }, { x: -350, y: 300 }] };
          setSource({ ...source, sketch });
        }}><option value="rectangle">Rectangle</option><option value="circle">Circle</option><option value="polygon">Point / Line</option><option value="bezier">Bezier Curve</option></select></label>
        {source.sketch.kind === "rectangle" && <div className="property-grid"><NumberField label="너비" value={source.sketch.width} min={1} onCommit={(width) => setSource({ ...source, sketch: { ...source.sketch, width } as SketchDefinition })} /><NumberField label="높이" value={source.sketch.height} min={1} onCommit={(height) => setSource({ ...source, sketch: { ...source.sketch, height } as SketchDefinition })} /></div>}
        {source.sketch.kind === "circle" && <NumberField label="반지름" value={source.sketch.radius} min={1} onCommit={(radius) => setSource({ ...source, sketch: { ...source.sketch, radius } as SketchDefinition })} />}
        {source.sketch.kind === "polygon" && <PointsField label="Point / Line 외곽선" dimensions={2} value={source.sketch.points} onCommit={(points) => setSource({ ...source, sketch: { ...source.sketch, points } as SketchDefinition })} />}
        {source.sketch.kind === "bezier" && <p className="hint">Bezier 제어점은 source에 보존되며 기본 폐곡선을 실제 Extrude합니다.</p>}
      </div>
    );
  }
  if (source.kind === "sweep") {
    return (
      <div className="property-stack">
        <label className="field"><span>Path</span><select value={source.path.curve} onChange={(event) => setSource({ ...source, path: { ...source.path, curve: event.currentTarget.value as "linear" | "catmull-rom" } })}><option value="linear">직선 연결</option><option value="catmull-rom">부드러운 Curve</option></select></label>
        <PointsField label="3D Path Point" dimensions={3} value={source.path.points} onCommit={(points) => setSource({ ...source, path: { ...source.path, points } })} />
        <label className="field"><span>Cross Section</span><select value={source.crossSection.kind} onChange={(event) => setSource({ ...source, crossSection: event.currentTarget.value === "circle" ? { kind: "circle", radius: 45, segments: 24 } : { kind: event.currentTarget.value as "rectangle" | "thin-rectangle", width: 100, height: event.currentTarget.value === "thin-rectangle" ? 12 : 100 } })}><option value="circle">원형</option><option value="rectangle">사각형</option><option value="thin-rectangle">얇은 사각형</option></select></label>
        {source.crossSection.kind === "circle" ? <NumberField label="단면 반지름" value={source.crossSection.radius} min={1} onCommit={(radius) => setSource({ ...source, crossSection: { ...source.crossSection, radius } as CrossSection })} /> : <div className="property-grid"><NumberField label="단면 너비" value={source.crossSection.width} min={1} onCommit={(width) => setSource({ ...source, crossSection: { ...source.crossSection, width } as CrossSection })} /><NumberField label="단면 높이" value={source.crossSection.height} min={1} onCommit={(height) => setSource({ ...source, crossSection: { ...source.crossSection, height } as CrossSection })} /></div>}
      </div>
    );
  }
  return (
    <div className="property-stack">
      <PointsField label="Profile (반지름, Y)" dimensions={2} value={source.profile} onCommit={(profile) => setSource({ ...source, profile })} />
      <div className="property-grid"><NumberField label="회전 각도" value={source.angle} suffix="°" min={1} onCommit={(angle) => setSource({ ...source, angle })} /><NumberField label="Segments" value={source.segments} suffix="" min={8} onCommit={(segments) => setSource({ ...source, segments: Math.round(segments) })} /></div>
    </div>
  );
}

function setGlbMaterialMode(part: AssetPartNode, materialMode: "original" | "override"): AssetPartNode {
  return part.source.kind === "glb" ? { ...part, source: { ...part.source, materialMode } } : part;
}

export function AssetBuilder({ initialAsset, onBack, onSave, onAddToSpace }: Props) {
  const history = useHistory(normalizeAsset(structuredClone(initialAsset)));
  const asset = history.state;
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialAsset.nodes[0] ? [initialAsset.nodes[0].id] : []);
  const [regionId, setRegionId] = useState("default");
  const [interactionMode, setInteractionMode] = useState<"view" | "place" | "geometry">("view");
  const [coordinateSpace, setCoordinateSpace] = useState<"local" | "world">("local");
  const [outlinerSearch, setOutlinerSearch] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [isolateIds, setIsolateIds] = useState<string[]>([]);
  const [glbLoading, setGlbLoading] = useState(false);
  const [materialPreview, setMaterialPreview] = useState<{ nodeId: string; regionId: string; image: string }>();
  const glbInput = useRef<HTMLInputElement>(null);
  const clipboard = useRef<{ asset: AssetDefinition; rootIds: string[] } | null>(null);
  const bounds = useMemo(() => getAssetBounds(asset), [asset]);
  const selected = selectedIds.length === 1 ? asset.nodes.find((node) => node.id === selectedIds[0]) : undefined;
  const selectedDisplayTransform = useMemo(() => selected && coordinateSpace === "world" ? worldTransform(selected.id, asset.nodes) ?? selected.transform : selected?.transform, [asset.nodes, coordinateSpace, selected]);
  const selectedPath = useMemo(() => selectedIds.length > 1 ? [asset.name, `${selectedIds.length}개 선택`] : selectionPath(selected?.id, asset.nodes, asset.name), [asset.name, asset.nodes, selected?.id, selectedIds.length]);
  const selectedEditLocked = selected ? isEditLocked(selected.id, asset.nodes) : false;
  const selectedTransformLocked = selected ? isTransformLocked(selected.id, asset.nodes) : false;

  useEffect(() => {
    history.reset(normalizeAsset(structuredClone(initialAsset)));
    setSelectedIds(initialAsset.nodes[0] ? [initialAsset.nodes[0].id] : []);
  }, [initialAsset.id]);
  useEffect(() => setSelectedIds((current) => current.filter((id) => asset.nodes.some((node) => node.id === id))), [asset.nodes]);
  useEffect(() => setMaterialPreview(undefined), [regionId, selected?.id]);

  const commit = useCallback((recipe: (draft: AssetDefinition) => void) => {
    history.commit((current) => {
      const next = structuredClone(current);
      recipe(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, [history.commit]);

  const selectNode = useCallback((id: string, additive: boolean) => {
    if (!id) return setSelectedIds([]);
    setSelectedIds((current) => additive
      ? current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
      : [id]);
  }, []);

  const removeSelected = useCallback(() => {
    if (!selectedIds.length) return;
    const roots = selectionRoots(selectedIds, asset.nodes).filter((id) =>
      !isEditLocked(id, asset.nodes) && descendantsOf(id, asset.nodes).every((node) => !isEditLocked(node.id, asset.nodes)),
    );
    if (!roots.length) return;
    commit((draft) => {
      const removing = new Set(roots.flatMap((id) => [id, ...descendantsOf(id, draft.nodes).map((node) => node.id)]));
      draft.nodes = draft.nodes.filter((node) => !removing.has(node.id));
    });
    const removed = new Set(roots.flatMap((id) => [id, ...descendantsOf(id, asset.nodes).map((node) => node.id)]));
    setSelectedIds((current) => current.filter((id) => !removed.has(id)));
  }, [asset.nodes, commit, selectedIds]);

  const copySelected = useCallback(() => {
    if (!selectedIds.length) return;
    clipboard.current = { asset: structuredClone(asset), rootIds: selectionRoots(selectedIds, asset.nodes) };
  }, [asset, selectedIds]);

  const paste = useCallback(() => {
    if (!clipboard.current) return;
    const allowedSourceRoots = clipboard.current.rootIds.filter((rootId) => {
      const sourceRoot = clipboard.current!.asset.nodes.find((node) => node.id === rootId);
      return sourceRoot && (!sourceRoot.parentId || !isEditLocked(sourceRoot.parentId, asset.nodes));
    });
    if (!allowedSourceRoots.length) return;
    const pasted = cloneSubtree(clipboard.current.asset, allowedSourceRoots);
    commit((draft) => draft.nodes.push(...pasted));
    const pastedRoots = pasted.filter((node) => !node.parentId || !pasted.some((candidate) => candidate.id === node.parentId));
    setSelectedIds(pastedRoots.map((node) => node.id));
  }, [asset.nodes, commit]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || isEditableTarget(event.target)) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelected();
        return;
      }
      if (command && event.key.toLowerCase() === "v") {
        event.preventDefault();
        paste();
        return;
      }
      const wantsDelete = !command && (event.code === "KeyX" || event.key === "Delete" || event.key === "Backspace");
      if (wantsDelete && selectedIds.length) {
        event.preventDefault();
        removeSelected();
      } else if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo(); else history.undo();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [copySelected, history.redo, history.undo, paste, removeSelected, selectedIds.length]);

  const addPart = (source: GeometrySource, name: string, color = "#ff6b35") => {
    const part = createPart(structuredClone(source), name, color);
    commit((draft) => draft.nodes.push(part));
    setSelectedIds([part.id]);
    setInteractionMode(source.kind === "primitive" || source.kind === "glb" ? "place" : "geometry");
    return part.id;
  };

  const updateNode = (next: AssetNode) => commit((draft) => {
    const current = draft.nodes.find((node) => node.id === next.id);
    if (!current || isEditLocked(next.id, draft.nodes)) return;
    const transformChanged = JSON.stringify(current.transform) !== JSON.stringify(next.transform);
    const pivotChanged = JSON.stringify(current.pivot) !== JSON.stringify(next.pivot);
    if ((transformChanged || pivotChanged) && isTransformLocked(next.id, draft.nodes)) return;
    draft.nodes = draft.nodes.map((node) => node.id === next.id ? next : node);
  });

  const updateSelectedTransform = (transform: NodeTransform) => {
    if (!selected) return;
    if (coordinateSpace === "local") {
      updateNode({ ...selected, transform });
      return;
    }
    commit((draft) => { draft.nodes = setWorldTransform(draft.nodes, selected.id, transform); });
  };

  const duplicate = () => {
    if (!selectedIds.length) return;
    const roots = selectionRoots(selectedIds, asset.nodes).filter((id) => {
      const node = asset.nodes.find((candidate) => candidate.id === id);
      return node && (!node.parentId || !isEditLocked(node.parentId, asset.nodes));
    });
    if (!roots.length) return;
    const cloned = cloneSubtree(asset, roots);
    commit((draft) => draft.nodes.push(...cloned));
    setSelectedIds(cloned.filter((node) => roots.some((rootId) => asset.nodes.find((candidate) => candidate.id === rootId)?.parentId === node.parentId)).map((node) => node.id));
  };

  const group = () => {
    if (selectedIds.length < 2) return;
    const roots = selectionRoots(selectedIds, asset.nodes).filter((id) => !isEditLocked(id, asset.nodes));
    if (roots.length < 2) return;
    const selectionBounds = getSelectionBounds(asset, roots);
    const groupNode: AssetGroupNode = {
      id: createId("group"), type: "group", parentId: selectionBounds.parentId, name: "새 그룹", visible: true,
      locks: { transform: false, edit: false }, pivot: { mode: "center", offset: { x: 0, y: 0, z: 0 } },
      transform: { position: { ...selectionBounds.bounds.center }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    };
    commit((draft) => {
      if (groupNode.parentId && isEditLocked(groupNode.parentId, draft.nodes)) return;
      draft.nodes.push(groupNode);
      roots.forEach((id) => { draft.nodes = reparentKeepingWorld(draft.nodes, id, groupNode.id); });
    });
    setSelectedIds([groupNode.id]);
  };

  const ungroup = () => {
    const groups = asset.nodes.filter((node): node is AssetGroupNode => selectedIds.includes(node.id) && node.type === "group" && !isEditLocked(node.id, asset.nodes) && descendantsOf(node.id, asset.nodes).every((child) => !isEditLocked(child.id, asset.nodes)));
    if (!groups.length) return;
    commit((draft) => groups.forEach((groupNode) => {
      const childIds = draft.nodes.filter((node) => node.parentId === groupNode.id).map((node) => node.id);
      childIds.forEach((id) => { draft.nodes = reparentKeepingWorld(draft.nodes, id, groupNode.parentId); });
      draft.nodes = draft.nodes.filter((node) => node.id !== groupNode.id);
    }));
    setSelectedIds([]);
  };

  const align = (axis: "x" | "y" | "z") => {
    const nodes = asset.nodes.filter((node) => selectedIds.includes(node.id) && !isTransformLocked(node.id, asset.nodes));
    if (nodes.length < 2) return;
    const value = nodes.reduce((sum, node) => sum + node.transform.position[axis], 0) / nodes.length;
    commit((draft) => draft.nodes = draft.nodes.map((node) => selectedIds.includes(node.id) && !isTransformLocked(node.id, draft.nodes) ? { ...node, transform: { ...node.transform, position: { ...node.transform.position, [axis]: value } } } : node));
  };

  const reparent = (nodeId: string, parentId: string | null) => commit((draft) => {
    draft.nodes = reparentKeepingWorld(draft.nodes, nodeId, parentId);
  });

  const toggleVisibility = (nodeId: string) => commit((draft) => {
    draft.nodes = draft.nodes.map((node) => node.id === nodeId ? { ...node, visible: !node.visible } : node);
  });

  const toggleLock = (nodeId: string, kind: "transform" | "edit") => commit((draft) => {
    const node = draft.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const inheritedEditLock = ancestorsOf(nodeId, draft.nodes).some((ancestor) => ancestor.locks.edit);
    if (inheritedEditLock || (kind === "transform" && node.locks.edit)) return;
    draft.nodes = draft.nodes.map((candidate) => candidate.id === nodeId ? { ...candidate, locks: { ...candidate.locks, [kind]: !candidate.locks[kind] } } : candidate);
  });

  const save = () => onSave({ ...asset, updatedAt: new Date().toISOString() });

  return (
    <main className="studio-shell builder-shell" data-testid="asset-builder">
      <header className="studio-topbar">
        <div className="topbar-left">
          <button className="icon-button" aria-label="뒤로" onClick={onBack}><ChevronLeft /></button>
          <div><span className="eyebrow">UNIVERSAL OBJECT BUILDER</span><input className="asset-name-input" value={asset.name} onChange={(event) => { const name = event.currentTarget.value; commit((draft) => { draft.name = name; }); }} /></div>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" aria-label="실행 취소" disabled={!history.canUndo} onClick={history.undo}><Undo2 /></button>
          <button className="icon-button" aria-label="다시 실행" disabled={!history.canRedo} onClick={history.redo}><Redo2 /></button>
          <button className="secondary-button" onClick={save}><Save size={16} /> 저장</button>
          <button className="primary-button" onClick={() => onAddToSpace(asset)}>{t("addToSpace")}</button>
        </div>
      </header>

      <section className="studio-workspace">
        <aside className="studio-panel left-panel">
          <section className="panel-section">
            <label className="field field-stack"><span>오브젝트 설명</span><textarea value={asset.description} placeholder="형태, 용도, 조립 메모" onChange={(event) => { const description = event.currentTarget.value; commit((draft) => { draft.description = description; }); }} /></label>
          </section>
          <section className="panel-section">
            <h2>Part 추가</h2>
            <div className="primitive-grid">
              {DEFAULT_SOURCES.map((tool) => <button key={tool.label} onClick={() => addPart(tool.source, tool.label, tool.color)}><tool.icon size={18} /><span>{tool.label}</span></button>)}
            </div>
            <div className="operation-list">
              {TOOL_SOURCES.map((tool) => <button key={tool.label} onClick={() => addPart(tool.source, tool.label)}><strong>{tool.label}</strong><small>{tool.description}</small></button>)}
            </div>
            <button className="advanced-button" disabled={glbLoading} onClick={() => glbInput.current?.click()}><FolderUp size={16} /> {glbLoading ? "GLB 읽는 중…" : "GLB 가져오기"} <em>고급</em></button>
            <input
              ref={glbInput}
              className="visually-hidden"
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                setGlbLoading(true);
                try {
                  addPart({ kind: "glb", dataUrl: await readFileAsDataUrl(file), fileName: file.name, dimensions: { width: 1000, depth: 1000, height: 1000 }, orientation: { x: 0, y: 0, z: 0 }, materialMode: "original" }, file.name);
                } finally {
                  setGlbLoading(false);
                  input.value = "";
                }
              }}
            />
          </section>
          <section className="panel-section hierarchy-section">
            <div className="section-heading"><h2>Outliner / 구조</h2><span>{asset.nodes.length}</span></div>
            <label className="outliner-search"><Search /><input value={outlinerSearch} onChange={(event) => setOutlinerSearch(event.currentTarget.value)} placeholder="Part / Group 검색" /></label>
            <button className={`asset-root-row ${selectedIds.length ? "" : "selected"}`} aria-pressed={!selectedIds.length} onClick={() => setSelectedIds([])} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/hustle-node-id"); if (id) reparent(id, null); }}><Boxes size={14} /> 전체 에셋 <span>{asset.name}</span></button>
            {asset.nodes.length ? <Hierarchy asset={asset} selectedIds={selectedIds} search={outlinerSearch} collapsed={collapsedIds} onSelect={selectNode} onExpand={(id) => setCollapsedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onRename={(id, name) => commit((draft) => { if (!isEditLocked(id, draft.nodes)) draft.nodes = draft.nodes.map((node) => node.id === id ? { ...node, name } : node); })} onVisibility={toggleVisibility} onLock={toggleLock} onReparent={reparent} /> : <p className="empty-note">왼쪽 도구에서 첫 Part를 추가하세요.</p>}
            <div className="mini-toolbar">
              <button onClick={duplicate} disabled={!selectedIds.length} title="복제"><Copy /></button>
              <button onClick={group} disabled={selectedIds.length < 2} title="그룹"><Group /></button>
              <button onClick={ungroup} disabled={!selectedIds.some((id) => asset.nodes.find((node) => node.id === id)?.type === "group")} title="그룹 해제"><Ungroup /></button>
              <button onClick={removeSelected} disabled={!selectedIds.length} title="삭제"><Trash2 /></button>
            </div>
            <button className={`isolate-button ${isolateIds.length ? "active" : ""}`} disabled={!selectedIds.length && !isolateIds.length} onClick={() => setIsolateIds((current) => current.length ? [] : [...selectedIds])}><Focus /> {isolateIds.length ? "전체 보기로 돌아가기" : "선택 항목만 보기"}</button>
            <div className="align-row">
              <button onClick={() => align("x")} disabled={selectedIds.length < 2}><AlignCenterVertical size={14} /> X 정렬</button>
              <button onClick={() => align("y")} disabled={selectedIds.length < 2}><AlignCenterHorizontal size={14} /> Y 정렬</button>
              <button onClick={() => align("z")} disabled={selectedIds.length < 2}>Z 정렬</button>
            </div>
          </section>
        </aside>

        <div className="studio-canvas">
          <div className="interaction-modes" role="group" aria-label="조작 모드">
            <button className={interactionMode === "view" ? "active" : ""} onClick={() => setInteractionMode("view")}><Eye /> 보기</button>
            <button className={interactionMode === "place" ? "active" : ""} onClick={() => setInteractionMode("place")}><Move3d /> 배치</button>
            <button className={interactionMode === "geometry" ? "active" : ""} onClick={() => setInteractionMode("geometry")}><PenTool /> 형상 편집</button>
          </div>
          {interactionMode === "place" && <div className="coordinate-toggle"><button className={coordinateSpace === "local" ? "active" : ""} onClick={() => setCoordinateSpace("local")}>Local</button><button className={coordinateSpace === "world" ? "active" : ""} onClick={() => setCoordinateSpace("world")}>World</button></div>}
          <nav className="selection-breadcrumb" aria-label="현재 선택 경로">{selectedPath.map((name, index) => <span key={`${name}-${index}`}>{index > 0 && <ChevronRight />} {name}</span>)}</nav>
          <AssetScene
            asset={asset}
            selectedIds={selectedIds}
            onSelect={selectNode}
            interactionMode={interactionMode}
            isolateIds={isolateIds}
            coordinateSpace={coordinateSpace}
            materialPreview={materialPreview}
            onTransformChange={(nodeId, transform) => commit((draft) => {
              const origin = draft.nodes.find((node) => node.id === nodeId);
              if (!origin || isTransformLocked(nodeId, draft.nodes)) return;
              const roots = selectionRoots(selectedIds.includes(nodeId) ? selectedIds : [nodeId], draft.nodes);
              const originTransform = coordinateSpace === "world" ? worldTransform(nodeId, draft.nodes) ?? origin.transform : origin.transform;
              const positionDelta = { x: transform.position.x - originTransform.position.x, y: transform.position.y - originTransform.position.y, z: transform.position.z - originTransform.position.z };
              const rotationDelta = { x: transform.rotation.x - originTransform.rotation.x, y: transform.rotation.y - originTransform.rotation.y, z: transform.rotation.z - originTransform.rotation.z };
              const snapshots = roots.flatMap((id) => {
                const candidate = draft.nodes.find((node) => node.id === id);
                if (!candidate || isTransformLocked(id, draft.nodes)) return [];
                return [{ id, candidate, current: coordinateSpace === "world" ? worldTransform(id, draft.nodes) ?? candidate.transform : candidate.transform }];
              });
              const sameParent = snapshots.every(({ candidate }) => candidate.parentId === snapshots[0]?.candidate.parentId);
              const pivot = snapshots.reduce((sum, snapshot) => ({ x: sum.x + snapshot.current.position.x, y: sum.y + snapshot.current.position.y, z: sum.z + snapshot.current.position.z }), { x: 0, y: 0, z: 0 });
              if (snapshots.length) { pivot.x /= snapshots.length; pivot.y /= snapshots.length; pivot.z /= snapshots.length; }
              const deltaEuler = new THREE.Euler(THREE.MathUtils.degToRad(rotationDelta.x), THREE.MathUtils.degToRad(rotationDelta.y), THREE.MathUtils.degToRad(rotationDelta.z));
              snapshots.forEach(({ id, current }) => {
                const relative = new THREE.Vector3(current.position.x - pivot.x, current.position.y - pivot.y, current.position.z - pivot.z);
                if (snapshots.length > 1 && (coordinateSpace === "world" || sameParent)) relative.applyEuler(deltaEuler);
                const next = { ...current, position: { x: pivot.x + relative.x + positionDelta.x, y: pivot.y + relative.y + positionDelta.y, z: pivot.z + relative.z + positionDelta.z }, rotation: { x: current.rotation.x + rotationDelta.x, y: current.rotation.y + rotationDelta.y, z: current.rotation.z + rotationDelta.z } };
                draft.nodes = coordinateSpace === "world" ? setWorldTransform(draft.nodes, id, next) : draft.nodes.map((node) => node.id === id ? { ...node, transform: next } : node);
              });
            })}
            onSourceChange={(nodeId, source) => commit((draft) => {
              if (!isEditLocked(nodeId, draft.nodes)) draft.nodes = draft.nodes.map((node) => node.id === nodeId && node.type === "part" ? { ...node, source } : node);
            })}
            onBendChange={(nodeId, modifierId, patch) => commit((draft) => {
              if (!isEditLocked(nodeId, draft.nodes)) draft.nodes = draft.nodes.map((node) => node.id === nodeId && node.type === "part" ? { ...node, modifiers: node.modifiers.map((modifier) => modifier.id === modifierId ? { ...modifier, ...patch } as BendModifier : modifier) } : node);
            })}
          />
          <div className="mode-hint">{interactionMode === "view" ? "빈 공간 드래그: Orbit · 우클릭: Pan · 휠: Zoom" : interactionMode === "place" ? "축/회전 핸들만 오브젝트를 이동합니다. 카메라는 고정됩니다." : "Curve/Bend 핸들만 형상을 바꿉니다. 오브젝트와 카메라는 고정됩니다."}</div>
          <div className="canvas-status"><span>W {Math.round(bounds.width)} mm</span><span>D {Math.round(bounds.depth)} mm</span><span>H {Math.round(bounds.height)} mm</span><span>{selectedIds.length ? `${selectedIds.length}개 선택` : "오브젝트를 선택하세요"}</span></div>
        </div>

        <aside className="studio-panel right-panel">
          {!selected ? (
            <div className="inspector-empty"><Move3d /><h2>{selectedIds.length > 1 ? `${selectedIds.length}개 Node 선택됨` : "전체 Asset 선택"}</h2><p>{selectedIds.length > 1 ? "공통 Transform gizmo와 구조 작업이 선택된 Part와 Group에 함께 적용됩니다." : "Asset 이름과 설명은 상단과 왼쪽 패널에서 수정하고, Part 또는 Group을 선택하면 세부 속성을 편집할 수 있습니다."}</p></div>
          ) : (
            <>
              <section className="panel-section">
                <span className="eyebrow">{selected.type === "part" ? selected.source.kind.toUpperCase() : "GROUP"}</span>
                <input className="inspector-name" value={selected.name} disabled={selectedEditLocked} onChange={(event) => updateNode({ ...selected, name: event.currentTarget.value })} />
                <div className="selection-level"><span>{selected.type === "group" ? "Group 선택" : interactionMode === "geometry" ? "Part · Geometry Control" : "Part 선택"}</span>{selectedTransformLocked && <span className="lock-badge">위치 잠금</span>}{selectedEditLocked && <span className="lock-badge edit">편집 잠금{selected.locks?.edit ? "" : " · Parent"}</span>}</div>
              </section>
              <section className="panel-section">
                <div className="section-heading"><h2>Transform</h2><span>{coordinateSpace === "local" ? "LOCAL" : "WORLD"}</span></div>
                <div className="property-grid three">{(["x", "y", "z"] as const).map((axis) => <NumberField disabled={selectedTransformLocked} key={`${coordinateSpace}-position-${axis}`} label={`위치 ${axis.toUpperCase()}`} value={selectedDisplayTransform?.position[axis] ?? 0} onCommit={(value) => selectedDisplayTransform && updateSelectedTransform({ ...selectedDisplayTransform, position: { ...selectedDisplayTransform.position, [axis]: value } })} />)}</div>
                <div className="property-grid three">{(["x", "y", "z"] as const).map((axis) => <NumberField disabled={selectedTransformLocked} key={`${coordinateSpace}-rotation-${axis}`} label={`회전 ${axis.toUpperCase()}`} value={selectedDisplayTransform?.rotation[axis] ?? 0} suffix="°" onCommit={(value) => selectedDisplayTransform && updateSelectedTransform({ ...selectedDisplayTransform, rotation: { ...selectedDisplayTransform.rotation, [axis]: value } })} />)}</div>
                <label className="field"><span>Pivot / Origin</span><select disabled={selectedTransformLocked} value={selected.pivot?.mode ?? "center"} onChange={(event) => updateNode({ ...selected, pivot: { ...selected.pivot, mode: event.currentTarget.value as "center" | "bottom-center" | "custom", offset: selected.pivot?.offset ?? { x: 0, y: 0, z: 0 } } })}><option value="center">중심</option><option value="bottom-center">바닥 중심</option><option value="custom">사용자 지정</option></select></label>
                {selected.pivot?.mode === "custom" && <div className="property-grid three">{(["x", "y", "z"] as const).map((axis) => <NumberField disabled={selectedTransformLocked} key={axis} label={`Pivot ${axis.toUpperCase()}`} value={selected.pivot.offset[axis]} onCommit={(value) => updateNode({ ...selected, pivot: { ...selected.pivot, offset: { ...selected.pivot.offset, [axis]: value } } })} />)}</div>}
              </section>
              {selected.type === "part" && (
                <fieldset className="inspector-fieldset" disabled={selectedEditLocked}>
                  <section className="panel-section"><h2>Geometry</h2><GeometryEditor part={selected} update={updateNode} /></section>
                  {selected.source.kind !== "glb" && (
                    <section className="panel-section">
                      <div className="section-heading"><h2>Bend</h2><button className="small-button" onClick={() => { updateNode({ ...selected, modifiers: [...selected.modifiers, { id: createId("bend"), kind: "bend", enabled: true, axis: "x", angle: 35, radius: 500, range: 1 }] }); setInteractionMode("geometry"); }}>+ 휘기</button></div>
                      {selected.modifiers.length === 0 && <p className="empty-note">원본 Geometry는 유지됩니다. Bend를 추가해 비파괴적으로 휘어 보세요.</p>}
                      {selected.modifiers.map((modifier) => <div className="modifier-card" key={modifier.id}>
                        <p className="gizmo-help"><span className="dot orange" /> 각도 · <span className="dot blue" /> 반경 · <span className="dot violet" /> 범위 핸들을 뷰포트에서 드래그하세요.</p>
                        <div className="section-heading"><label className="check-label"><input type="checkbox" checked={modifier.enabled} onChange={(event) => updateNode({ ...selected, modifiers: selected.modifiers.map((item) => item.id === modifier.id ? { ...item, enabled: event.currentTarget.checked } : item) })} /> 활성</label><button className="text-button danger" onClick={() => updateNode({ ...selected, modifiers: selected.modifiers.filter((item) => item.id !== modifier.id) })}>삭제</button></div>
                        <label className="field"><span>축</span><select value={modifier.axis} onChange={(event) => updateNode({ ...selected, modifiers: selected.modifiers.map((item) => item.id === modifier.id ? { ...item, axis: event.currentTarget.value as "x" | "y" | "z" } : item) })}><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
                        <NumberField label="각도" value={modifier.angle} suffix="°" onCommit={(angle) => updateNode({ ...selected, modifiers: selected.modifiers.map((item) => item.id === modifier.id ? { ...item, angle } : item) })} />
                        <NumberField label="반경" value={modifier.radius} min={1} onCommit={(radius) => updateNode({ ...selected, modifiers: selected.modifiers.map((item) => item.id === modifier.id ? { ...item, radius } : item) })} />
                        <NumberField label="휘는 범위" value={Math.round((modifier.range ?? 1) * 100)} suffix="%" min={5} onCommit={(value) => updateNode({ ...selected, modifiers: selected.modifiers.map((item) => item.id === modifier.id ? { ...item, range: Math.min(1, value / 100) } : item) })} />
                      </div>)}
                    </section>
                  )}
                  <section className="panel-section">
                    <h2>Material / Image</h2>
                    {selected.source.kind === "glb" ? <>
                      <div className="segmented"><button className={(selected.source.materialMode ?? "original") === "original" ? "active" : ""} onClick={() => updateNode(setGlbMaterialMode(selected, "original"))}>원본 재질</button><button className={selected.source.materialMode === "override" ? "active" : ""} onClick={() => updateNode(setGlbMaterialMode(selected, "override"))}>단색 Override</button></div>
                      {selected.source.materialMode === "override" && <MaterialEditor material={selected.material} onChange={(material) => updateNode({ ...selected, material })} onPreviewImageChange={(image) => setMaterialPreview(image ? { nodeId: selected.id, regionId: "default", image } : undefined)} />}
                    </> : (
                      <>
                        <label className="field"><span>영역</span><select value={regionId} onChange={(event) => setRegionId(event.currentTarget.value)}><option value="default">전체 기본</option>{geometryRegions(selected.source).map((region) => <option key={region.id} value={region.id}>{region.label}</option>)}</select></label>
                        <MaterialEditor
                          material={regionId === "default" ? selected.material : selected.regionMaterials[regionId] ?? createMaterial(selected.material.color)}
                          onChange={(material) => updateNode(regionId === "default" ? { ...selected, material } : { ...selected, regionMaterials: { ...selected.regionMaterials, [regionId]: material } })}
                          onPreviewImageChange={(image) => setMaterialPreview(image ? { nodeId: selected.id, regionId, image } : undefined)}
                        />
                      </>
                    )}
                  </section>
                </fieldset>
              )}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
