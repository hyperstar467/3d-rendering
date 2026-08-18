"use client";

import { ChevronLeft, Copy, Eye, Grid3X3, ImagePlus, Move3d, Pencil, Redo2, RotateCw, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DraftNumberInput } from "@/components/DraftNumberInput";
import { SpaceScene, type SpaceCameraRequest, type SpaceCameraView } from "@/components/studio/SpaceScene";
import { useHistory } from "@/studio/commands/useHistory";
import { createId } from "@/studio/domain/defaults";
import type { AssetDefinition, AssetInstance, SpaceDefinition, SurfaceSettings } from "@/studio/domain/types";
import { getAssetBounds } from "@/studio/geometry/bounds";
import { clampInstance, placementClearances, snapValue } from "@/studio/space/placement";

type Props = {
  space: SpaceDefinition;
  assets: AssetDefinition[];
  onChange: (space: SpaceDefinition) => void;
  onBack: () => void;
  onEditAsset: (assetId: string) => void;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`));
    reader.readAsDataURL(file);
  });
}

const TILE_TEXTURE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="#d8d8d4"/><path d="M0 0H128V128H0Z M64 0V128 M0 64H128" fill="none" stroke="#9b9c97" stroke-width="2"/></svg>')}`;
const FLOOR_PRESETS: Array<{ name: string; patch: Partial<SurfaceSettings> }> = [
  { name: "진회색 바닥", patch: { color: "#454847", image: undefined, imageName: undefined } },
  { name: "중성 회색", patch: { color: "#8b8d89", image: undefined, imageName: undefined } },
  { name: "기본 타일", patch: { color: "#d8d8d4", image: TILE_TEXTURE, imageName: "기본 타일", fit: "cover", zoom: 1, x: 0, y: 0, rotation: 0 } },
];
const WALL_PRESETS: Array<{ name: string; patch: Partial<SurfaceSettings> }> = [
  { name: "웜 화이트", patch: { color: "#f1eee7", image: undefined, imageName: undefined } },
  { name: "순백", patch: { color: "#ffffff", image: undefined, imageName: undefined } },
  { name: "차콜", patch: { color: "#343634", image: undefined, imageName: undefined } },
];

function DimensionDraft({ space, onApply }: { space: SpaceDefinition; onApply: (values: { width: number; depth: number; height: number }) => void }) {
  const [draft, setDraft] = useState({ width: String(space.width), depth: String(space.depth), height: String(space.height) });
  useEffect(() => setDraft({ width: String(space.width), depth: String(space.depth), height: String(space.height) }), [space.depth, space.height, space.width]);
  const valid = Object.values(draft).every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) > 0);
  return (
    <div className="dimension-draft">
      <div className="property-grid three">{(["width", "depth", "height"] as const).map((key) => <label className="field" key={key}><span>{key === "width" ? "W" : key === "depth" ? "D" : "H"}</span><span className="number-wrap"><input type="number" value={draft[key]} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, [key]: value })); }} /><small>mm</small></span></label>)}</div>
      <button className="secondary-button full" disabled={!valid} onClick={() => onApply({ width: Number(draft.width), depth: Number(draft.depth), height: Number(draft.height) })}>공간 치수 적용</button>
    </div>
  );
}

function SurfaceEditor({ surfaceId, title, surface, presets, onChange, onPreviewImageChange }: { surfaceId: "floor" | "back" | "left" | "right"; title: string; surface: SurfaceSettings; presets: Array<{ name: string; patch: Partial<SurfaceSettings> }>; onChange: (surface: SurfaceSettings) => void; onPreviewImageChange: (image?: string) => void }) {
  const latestSurface = useRef(surface);
  const objectUrl = useRef<string | undefined>(undefined);
  const previewCallback = useRef(onPreviewImageChange);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  latestSurface.current = surface;
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
      const image = await fileToDataUrl(file);
      onChange({ ...latestSurface.current, image, imageName: file.name });
      onPreviewImageChange(undefined);
    } catch (error) {
      onPreviewImageChange(undefined);
      setUploadError(error instanceof Error ? error.message : "이미지를 읽지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <details className="surface-card" data-testid={`surface-${surfaceId}`}>
      <summary><span>{title}</span><span className="surface-swatch" style={{ background: surface.color }} /></summary>
      <div className="surface-presets">{presets.map((preset) => <button key={preset.name} onClick={() => onChange({ ...surface, ...preset.patch })}>{preset.name}</button>)}</div>
      <label className="field color-field"><span>색상</span><input type="color" value={surface.color} onInput={(event) => onChange({ ...surface, color: event.currentTarget.value })} /></label>
      <label className="upload-button compact"><ImagePlus size={15} /> {loading ? "이미지 적용 중…" : "이미지 선택"}<input type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void chooseImage(file); event.currentTarget.value = ""; }} /></label>
      {uploadError && <p className="hint danger">{uploadError}</p>}
      {surface.image && <div className="property-stack">
        <p className="hint">이미지는 원본 색상으로 표시되고, 색상은 contain 여백과 이미지 밖 마감으로 사용됩니다.</p>
        <div className="segmented">{(["contain", "cover"] as const).map((fit) => <button key={fit} className={surface.fit === fit ? "active" : ""} onClick={() => onChange({ ...surface, fit })}>{fit === "contain" ? "맞춤" : "채우기"}</button>)}</div>
        <label className="field field-stack"><span>확대 {surface.zoom.toFixed(2)}×</span><input type="range" min="0.25" max="4" step="0.01" value={surface.zoom} onInput={(event) => onChange({ ...surface, zoom: Number(event.currentTarget.value) })} /></label>
        <label className="field field-stack"><span>X {surface.x}%</span><input type="range" min="-100" max="100" value={surface.x} onInput={(event) => onChange({ ...surface, x: Number(event.currentTarget.value) })} /></label>
        <label className="field field-stack"><span>Y {surface.y}%</span><input type="range" min="-100" max="100" value={surface.y} onInput={(event) => onChange({ ...surface, y: Number(event.currentTarget.value) })} /></label>
        <label className="field"><span>회전</span><span className="number-wrap"><DraftNumberInput value={surface.rotation} onCommit={(rotation) => onChange({ ...surface, rotation })} /><small>°</small></span></label>
        <button className="text-button danger" onClick={() => { onPreviewImageChange(undefined); onChange({ ...surface, image: undefined, imageName: undefined }); }}>이미지 제거</button>
      </div>}
    </details>
  );
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
}

export function SpaceStudio({ space: initialSpace, assets, onChange: onProjectSpaceChange, onBack, onEditAsset }: Props) {
  const history = useHistory(structuredClone(initialSpace));
  const space = history.state;
  const onProjectSpaceChangeRef = useRef(onProjectSpaceChange);
  onProjectSpaceChangeRef.current = onProjectSpaceChange;
  const [selectedId, setSelectedId] = useState<string | undefined>(() => initialSpace.instances.at(-1)?.id);
  const [error, setError] = useState<string>();
  const [interactionMode, setInteractionMode] = useState<"view" | "place">("view");
  const [surfacePreviews, setSurfacePreviews] = useState<Partial<Record<"floor" | "back" | "left" | "right", string>>>({});
  const [moveSnap, setMoveSnap] = useState(50);
  const [rotationSnap, setRotationSnap] = useState(15);
  const [cameraRequest, setCameraRequest] = useState<SpaceCameraRequest>({ id: 1, view: "perspective" });
  useEffect(() => { onProjectSpaceChangeRef.current(space); }, [space]);
  const commitSpace = useCallback((update: SpaceDefinition | ((current: SpaceDefinition) => SpaceDefinition)) => history.commit(update), [history.commit]);
  const selected = space.instances.find((instance) => instance.id === selectedId);
  const selectedAsset = assets.find((asset) => asset.id === selected?.assetId);
  const updateInstance = (id: string, update: (instance: AssetInstance) => AssetInstance) => commitSpace((current) => ({ ...current, instances: current.instances.map((instance) => instance.id === id ? update(instance) : instance) }));
  const updateInstanceInGesture = (id: string, update: (instance: AssetInstance) => AssetInstance) => history.updateTransaction((current) => ({ ...current, instances: current.instances.map((instance) => instance.id === id ? update(instance) : instance) }));
  const requestCamera = (view: SpaceCameraView) => setCameraRequest((current) => ({ id: current.id + 1, view }));
  const addAsset = (asset: AssetDefinition) => {
    const bounds = getAssetBounds(asset);
    const placement = clampInstance(bounds, space, 0, 0, 0);
    if (!placement.fits) return setError(placement.message);
    const instance = { id: createId("instance"), assetId: asset.id, name: asset.name, position: { x: placement.x, z: placement.z }, rotation: 0 };
    commitSpace((current) => ({ ...current, instances: [...current.instances, instance] }));
    setSelectedId(instance.id);
    setError(undefined);
  };
  const rotate = (rotation: number) => {
    if (!selected || !selectedAsset) return;
    const snappedRotation = snapValue(rotation, rotationSnap);
    const placement = clampInstance(getAssetBounds(selectedAsset), space, snappedRotation, selected.position.x, selected.position.z);
    if (!placement.fits) return setError(placement.message);
    updateInstance(selected.id, (instance) => ({ ...instance, rotation: snappedRotation, position: { x: placement.x, z: placement.z } }));
    setError(undefined);
  };
  const applySpaceSize = (dimensions: { width: number; depth: number; height: number }) => {
    let nextInstances = space.instances;
    for (const instance of space.instances) {
      const asset = assets.find((candidate) => candidate.id === instance.assetId);
      if (!asset) continue;
      const placement = clampInstance(getAssetBounds(asset), dimensions, instance.rotation, instance.position.x, instance.position.z);
      if (!placement.fits) return setError(placement.message);
      nextInstances = nextInstances.map((candidate) => candidate.id === instance.id ? { ...candidate, position: { x: placement.x, z: placement.z } } : candidate);
    }
    commitSpace({ ...space, ...dimensions, instances: nextInstances });
    setError(undefined);
  };
  const dimensions = useMemo(() => selectedAsset ? getAssetBounds(selectedAsset) : null, [selectedAsset]);
  const clearances = useMemo(() => selected && dimensions ? placementClearances(dimensions, space, selected.rotation, selected.position.x, selected.position.z) : null, [dimensions, selected, space]);
  const duplicateInstance = (instance: AssetInstance) => {
    const asset = assets.find((candidate) => candidate.id === instance.assetId);
    if (!asset) return;
    const bounds = getAssetBounds(asset);
    const placement = clampInstance(bounds, space, instance.rotation, snapValue(instance.position.x + 100, moveSnap), snapValue(instance.position.z + 100, moveSnap));
    if (!placement.fits) return setError(placement.message);
    const copy = { ...instance, id: createId("instance"), name: `${instance.name} 복사본`, position: { x: placement.x, z: placement.z } };
    commitSpace((current) => ({ ...current, instances: [...current.instances, copy] }));
    setSelectedId(copy.id);
  };
  const removeInstance = (instanceId: string) => {
    commitSpace((current) => ({ ...current, instances: current.instances.filter((instance) => instance.id !== instanceId) }));
    if (selectedId === instanceId) setSelectedId(undefined);
  };

  useEffect(() => {
    let changed = false;
    let nextInstances = space.instances;
    for (const instance of space.instances) {
      const asset = assets.find((candidate) => candidate.id === instance.assetId);
      if (!asset) continue;
      const placement = clampInstance(getAssetBounds(asset), space, instance.rotation, instance.position.x, instance.position.z);
      if (!placement.fits) {
        setError(placement.message);
        return;
      }
      if (placement.x !== instance.position.x || placement.z !== instance.position.z) {
        changed = true;
        nextInstances = nextInstances.map((candidate) => candidate.id === instance.id ? { ...candidate, position: { x: placement.x, z: placement.z } } : candidate);
      }
    }
    setError(undefined);
    if (changed) commitSpace({ ...space, instances: nextInstances });
  }, [assets]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || isEditableTarget(event.target)) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo(); else history.undo();
        return;
      }
      if (!command && selectedId && (event.code === "KeyX" || event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        commitSpace((current) => ({ ...current, instances: current.instances.filter((instance) => instance.id !== selectedId) }));
        setSelectedId(undefined);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [commitSpace, history.redo, history.undo, selectedId]);

  return (
    <main className="studio-shell builder-shell" data-testid="space-studio">
      <header className="studio-topbar">
        <div className="topbar-left"><button className="icon-button" aria-label="뒤로" onClick={onBack}><ChevronLeft /></button><div><span className="eyebrow">REAL-SCALE PLACEMENT</span><h1>공간 스튜디오</h1></div></div>
        <div className="toolbar-actions"><button className="icon-button" aria-label="실행 취소" disabled={!history.canUndo} onClick={history.undo}><Undo2 /></button><button className="icon-button" aria-label="다시 실행" disabled={!history.canRedo} onClick={history.redo}><Redo2 /></button><div className="canvas-status static"><span>{space.width} × {space.depth} × {space.height} mm</span><span>Three.js: 1 unit = 1 meter</span></div></div>
      </header>
      <section className="studio-workspace">
        <aside className="studio-panel left-panel">
          <section className="panel-section"><h2>공간 치수</h2><DimensionDraft space={space} onApply={applySpaceSize} /></section>
          <section className="panel-section">
            <h2>벽 / 바닥</h2>
            <label className="field"><span>벽 구성</span><select value={space.wallMode} onChange={(event) => { const wallMode = event.currentTarget.value as SpaceDefinition["wallMode"]; commitSpace((current) => ({ ...current, wallMode })); }}><option value="three">3면</option><option value="back">후면</option><option value="none">없음</option></select></label>
            <label className="check-row"><input type="checkbox" checked={space.gridVisible} onChange={(event) => { const gridVisible = event.currentTarget.checked; commitSpace((current) => ({ ...current, gridVisible })); }} /><Grid3X3 size={16} /> 500mm Grid</label>
            <SurfaceEditor surfaceId="floor" title="바닥" surface={space.floor} presets={FLOOR_PRESETS} onPreviewImageChange={(image) => setSurfacePreviews((current) => ({ ...current, floor: image }))} onChange={(floor) => commitSpace((current) => ({ ...current, floor }))} />
            <SurfaceEditor surfaceId="back" title="후면벽" surface={space.walls.back} presets={WALL_PRESETS} onPreviewImageChange={(image) => setSurfacePreviews((current) => ({ ...current, back: image }))} onChange={(back) => commitSpace((current) => ({ ...current, walls: { ...current.walls, back } }))} />
            <SurfaceEditor surfaceId="left" title="좌측벽" surface={space.walls.left} presets={WALL_PRESETS} onPreviewImageChange={(image) => setSurfacePreviews((current) => ({ ...current, left: image }))} onChange={(left) => commitSpace((current) => ({ ...current, walls: { ...current.walls, left } }))} />
            <SurfaceEditor surfaceId="right" title="우측벽" surface={space.walls.right} presets={WALL_PRESETS} onPreviewImageChange={(image) => setSurfacePreviews((current) => ({ ...current, right: image }))} onChange={(right) => commitSpace((current) => ({ ...current, walls: { ...current.walls, right } }))} />
          </section>
          <section className="panel-section"><h2>배치 Snap</h2><div className="property-grid"><label className="field"><span>이동</span><select aria-label="이동 Snap" value={moveSnap} onChange={(event) => setMoveSnap(Number(event.currentTarget.value))}><option value="0">끄기</option><option value="10">10 mm</option><option value="50">50 mm</option><option value="100">100 mm</option><option value="500">500 mm</option></select></label><label className="field"><span>회전</span><select aria-label="회전 Snap" value={rotationSnap} onChange={(event) => setRotationSnap(Number(event.currentTarget.value))}><option value="0">끄기</option><option value="15">15°</option><option value="45">45°</option><option value="90">90°</option></select></label></div></section>
          <section className="panel-section"><div className="section-heading"><h2>배치된 오브젝트</h2><span>{space.instances.length}</span></div>{space.instances.length ? <div className="space-instance-list">{space.instances.map((instance) => <div className={`space-instance-row ${selectedId === instance.id ? "selected" : ""}`} key={instance.id}><button className="space-instance-select" onClick={() => setSelectedId(instance.id)}><span>{instance.name}</span><small>X {Math.round(instance.position.x)} · Z {Math.round(instance.position.z)} · {Math.round(instance.rotation)}°</small></button><span className="space-instance-actions"><button aria-label={`${instance.name} 복제`} onClick={() => duplicateInstance(instance)}><Copy /></button><button aria-label={`${instance.name} 다시 편집`} onClick={() => onEditAsset(instance.assetId)}><Pencil /></button><button aria-label={`${instance.name} 삭제`} onClick={() => removeInstance(instance.id)}><Trash2 /></button></span></div>)}</div> : <p className="empty-note">공간에 배치된 오브젝트가 없습니다.</p>}</section>
          <section className="panel-section"><h2>내 오브젝트 추가</h2>{assets.length ? <div className="asset-add-list">{assets.map((asset) => <button key={asset.id} onClick={() => addAsset(asset)}><span>{asset.name}</span><small>+ 공간에 추가</small></button>)}</div> : <p className="empty-note">먼저 3D 오브젝트를 만들어 저장하세요.</p>}</section>
        </aside>
        <div className="studio-canvas">
          <div className="interaction-modes" role="group" aria-label="공간 조작 모드"><button className={interactionMode === "view" ? "active" : ""} onClick={() => setInteractionMode("view")}><Eye /> 보기</button><button className={interactionMode === "place" ? "active" : ""} onClick={() => setInteractionMode("place")}><Move3d /> 배치</button></div>
          <div className="space-camera-toolbar" role="group" aria-label="공간 Camera View">{([['perspective', '원근'], ['front', '정면'], ['back', '후면'], ['left', '좌측'], ['right', '우측'], ['top', '상단']] as Array<[SpaceCameraView, string]>).map(([view, label]) => <button key={view} className={cameraRequest.view === view ? "active" : ""} onClick={() => requestCamera(view)}>{label}</button>)}<button onClick={() => requestCamera("fit")}>전체 공간 보기</button><button disabled={!selectedId} onClick={() => requestCamera("selection")}>선택 항목 보기</button></div>
          <SpaceScene space={space} assets={assets} surfacePreviews={surfacePreviews} selectedId={selectedId} interactionMode={interactionMode} moveSnap={moveSnap} rotationSnap={rotationSnap} cameraRequest={cameraRequest} onGestureStart={history.beginTransaction} onGestureEnd={history.endTransaction} onSelect={setSelectedId} onMove={(instanceId, x, z) => updateInstanceInGesture(instanceId, (instance) => ({ ...instance, position: { x, z } }))} onRotate={(instanceId, rotation, x, z) => updateInstanceInGesture(instanceId, (instance) => ({ ...instance, rotation, position: { x, z } }))} onPlacementError={setError} />
          {error && <div className="error-toast">{error}</div>}
          <div className="canvas-help">{interactionMode === "view" ? "보기 모드 · 빈 공간 드래그 Orbit / Pan / Zoom" : "배치 모드 · 오브젝트 드래그 이동 / 주황 핸들 회전 · 카메라 고정"}</div>
        </div>
        <aside className="studio-panel right-panel">
          {selected && selectedAsset && dimensions ? <>
            <section className="panel-section"><span className="eyebrow">ASSET INSTANCE</span><h2 className="instance-title">{selected.name}</h2><p className="hint">AssetDefinition은 유지되고, 이 Instance의 위치와 회전만 달라집니다.</p></section>
            <section className="panel-section"><h2>실측 Bounding Size</h2><div className="metric-row"><span>W {Math.round(dimensions.width)}</span><span>D {Math.round(dimensions.depth)}</span><span>H {Math.round(dimensions.height)} mm</span></div></section>
            <section className="panel-section"><h2>배치</h2><div className="property-grid"><label className="field"><span>X</span><span className="number-wrap"><DraftNumberInput value={selected.position.x} onCommit={(value) => { const x = snapValue(value, moveSnap); const placement = clampInstance(dimensions, space, selected.rotation, x, selected.position.z); if (placement.fits) updateInstance(selected.id, (instance) => ({ ...instance, position: { x: placement.x, z: placement.z } })); else setError(placement.message); }} /><small>mm</small></span></label><label className="field"><span>Z</span><span className="number-wrap"><DraftNumberInput value={selected.position.z} onCommit={(value) => { const z = snapValue(value, moveSnap); const placement = clampInstance(dimensions, space, selected.rotation, selected.position.x, z); if (placement.fits) updateInstance(selected.id, (instance) => ({ ...instance, position: { x: placement.x, z: placement.z } })); else setError(placement.message); }} /><small>mm</small></span></label></div><label className="field"><span>Y 회전</span><span className="number-wrap"><DraftNumberInput value={selected.rotation} onCommit={rotate} /><small>°</small></span></label><div className="quick-rotate"><button onClick={() => rotate(selected.rotation - 15)}><RotateCw size={14} /> -15°</button><button onClick={() => rotate(selected.rotation + 15)}><RotateCw size={14} /> +15°</button><button onClick={() => rotate(selected.rotation + 90)}>+90°</button></div></section>
            {clearances && <section className="panel-section"><h2>벽 / 경계까지 거리</h2><div className="clearance-grid"><span>왼쪽<strong>{Math.round(clearances.left)} mm</strong></span><span>오른쪽<strong>{Math.round(clearances.right)} mm</strong></span><span>후면<strong>{Math.round(clearances.back)} mm</strong></span><span>전면<strong>{Math.round(clearances.front)} mm</strong></span></div><p className="hint">회전된 {Math.round(clearances.footprint.width)} × {Math.round(clearances.footprint.depth)} mm footprint 기준</p></section>}
            <section className="panel-section instance-actions"><button onClick={() => onEditAsset(selectedAsset.id)}><Pencil size={15} /> 다시 편집</button><button onClick={() => duplicateInstance(selected)}><Copy size={15} /> 복제</button><button className="danger" onClick={() => removeInstance(selected.id)}><Trash2 size={15} /> 삭제</button></section>
          </> : <div className="inspector-empty"><RotateCw /><h2>배치된 오브젝트 선택</h2><p>오브젝트를 클릭하면 정확한 위치·회전·복제·재편집 기능이 표시됩니다.</p></div>}
        </aside>
      </section>
    </main>
  );
}
