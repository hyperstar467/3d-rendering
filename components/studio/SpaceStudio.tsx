"use client";

import { ChevronLeft, Copy, Eye, Grid3X3, ImagePlus, Move3d, Pencil, Redo2, RotateCw, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DraftNumberInput } from "@/components/DraftNumberInput";
import { SpaceScene } from "@/components/studio/SpaceScene";
import { useHistory } from "@/studio/commands/useHistory";
import { createId } from "@/studio/domain/defaults";
import type { AssetDefinition, AssetInstance, SpaceDefinition, SurfaceSettings } from "@/studio/domain/types";
import { getAssetBounds } from "@/studio/geometry/bounds";
import { clampInstance } from "@/studio/space/placement";

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

function SurfaceEditor({ title, surface, presets, onChange }: { title: string; surface: SurfaceSettings; presets: Array<{ name: string; patch: Partial<SurfaceSettings> }>; onChange: (surface: SurfaceSettings) => void }) {
  const latestSurface = useRef(surface);
  const objectUrl = useRef<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  latestSurface.current = surface;
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  const chooseImage = async (file: File) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const previewUrl = URL.createObjectURL(file);
    objectUrl.current = previewUrl;
    setLoading(true);
    setUploadError(undefined);
    onChange({ ...latestSurface.current, image: previewUrl, imageName: file.name });
    try {
      const image = await fileToDataUrl(file);
      onChange({ ...latestSurface.current, image, imageName: file.name });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "이미지를 읽지 못했습니다.");
    } finally {
      URL.revokeObjectURL(previewUrl);
      if (objectUrl.current === previewUrl) objectUrl.current = undefined;
      setLoading(false);
    }
  };
  return (
    <details className="surface-card">
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
        <button className="text-button danger" onClick={() => onChange({ ...surface, image: undefined, imageName: undefined })}>이미지 제거</button>
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
  useEffect(() => { onProjectSpaceChangeRef.current(space); }, [space]);
  const commitSpace = useCallback((update: SpaceDefinition | ((current: SpaceDefinition) => SpaceDefinition)) => history.commit(update), [history.commit]);
  const selected = space.instances.find((instance) => instance.id === selectedId);
  const selectedAsset = assets.find((asset) => asset.id === selected?.assetId);
  const updateInstance = (id: string, update: (instance: AssetInstance) => AssetInstance) => commitSpace((current) => ({ ...current, instances: current.instances.map((instance) => instance.id === id ? update(instance) : instance) }));
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
    const placement = clampInstance(getAssetBounds(selectedAsset), space, rotation, selected.position.x, selected.position.z);
    if (!placement.fits) return setError(placement.message);
    updateInstance(selected.id, (instance) => ({ ...instance, rotation, position: { x: placement.x, z: placement.z } }));
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
            <SurfaceEditor title="바닥" surface={space.floor} presets={FLOOR_PRESETS} onChange={(floor) => commitSpace((current) => ({ ...current, floor }))} />
            <SurfaceEditor title="후면벽" surface={space.walls.back} presets={WALL_PRESETS} onChange={(back) => commitSpace((current) => ({ ...current, walls: { ...current.walls, back } }))} />
            <SurfaceEditor title="좌측벽" surface={space.walls.left} presets={WALL_PRESETS} onChange={(left) => commitSpace((current) => ({ ...current, walls: { ...current.walls, left } }))} />
            <SurfaceEditor title="우측벽" surface={space.walls.right} presets={WALL_PRESETS} onChange={(right) => commitSpace((current) => ({ ...current, walls: { ...current.walls, right } }))} />
          </section>
          <section className="panel-section"><h2>내 오브젝트 추가</h2>{assets.length ? <div className="asset-add-list">{assets.map((asset) => <button key={asset.id} onClick={() => addAsset(asset)}><span>{asset.name}</span><small>+ 공간에 추가</small></button>)}</div> : <p className="empty-note">먼저 3D 오브젝트를 만들어 저장하세요.</p>}</section>
        </aside>
        <div className="studio-canvas">
          <div className="interaction-modes" role="group" aria-label="공간 조작 모드"><button className={interactionMode === "view" ? "active" : ""} onClick={() => setInteractionMode("view")}><Eye /> 보기</button><button className={interactionMode === "place" ? "active" : ""} onClick={() => setInteractionMode("place")}><Move3d /> 배치</button></div>
          <SpaceScene space={space} assets={assets} selectedId={selectedId} interactionMode={interactionMode} onSelect={setSelectedId} onMove={(instanceId, x, z) => updateInstance(instanceId, (instance) => ({ ...instance, position: { x, z } }))} onRotate={(instanceId, rotation, x, z) => updateInstance(instanceId, (instance) => ({ ...instance, rotation, position: { x, z } }))} onPlacementError={setError} />
          {error && <div className="error-toast">{error}</div>}
          <div className="canvas-help">{interactionMode === "view" ? "보기 모드 · 빈 공간 드래그 Orbit / Pan / Zoom" : "배치 모드 · 오브젝트 드래그 이동 / 주황 핸들 회전 · 카메라 고정"}</div>
        </div>
        <aside className="studio-panel right-panel">
          {selected && selectedAsset && dimensions ? <>
            <section className="panel-section"><span className="eyebrow">ASSET INSTANCE</span><h2 className="instance-title">{selected.name}</h2><p className="hint">AssetDefinition은 유지되고, 이 Instance의 위치와 회전만 달라집니다.</p></section>
            <section className="panel-section"><h2>실측 Bounding Size</h2><div className="metric-row"><span>W {Math.round(dimensions.width)}</span><span>D {Math.round(dimensions.depth)}</span><span>H {Math.round(dimensions.height)} mm</span></div></section>
            <section className="panel-section"><h2>배치</h2><div className="property-grid"><label className="field"><span>X</span><span className="number-wrap"><DraftNumberInput value={selected.position.x} onCommit={(x) => { const placement = clampInstance(dimensions, space, selected.rotation, x, selected.position.z); if (placement.fits) updateInstance(selected.id, (instance) => ({ ...instance, position: { x: placement.x, z: placement.z } })); else setError(placement.message); }} /><small>mm</small></span></label><label className="field"><span>Z</span><span className="number-wrap"><DraftNumberInput value={selected.position.z} onCommit={(z) => { const placement = clampInstance(dimensions, space, selected.rotation, selected.position.x, z); if (placement.fits) updateInstance(selected.id, (instance) => ({ ...instance, position: { x: placement.x, z: placement.z } })); else setError(placement.message); }} /><small>mm</small></span></label></div><label className="field"><span>Y 회전</span><span className="number-wrap"><DraftNumberInput value={selected.rotation} onCommit={rotate} /><small>°</small></span></label><div className="quick-rotate"><button onClick={() => rotate(selected.rotation - 15)}><RotateCw size={14} /> -15°</button><button onClick={() => rotate(selected.rotation + 15)}><RotateCw size={14} /> +15°</button><button onClick={() => rotate(selected.rotation + 90)}>+90°</button></div></section>
            <section className="panel-section instance-actions"><button onClick={() => onEditAsset(selectedAsset.id)}><Pencil size={15} /> 다시 편집</button><button onClick={() => { const copy = { ...selected, id: createId("instance"), name: `${selected.name} 복사본`, position: { x: selected.position.x + 100, z: selected.position.z + 100 } }; const placement = clampInstance(dimensions, space, copy.rotation, copy.position.x, copy.position.z); if (placement.fits) commitSpace((current) => ({ ...current, instances: [...current.instances, { ...copy, position: { x: placement.x, z: placement.z } }] })); }}><Copy size={15} /> 복제</button><button className="danger" onClick={() => { commitSpace((current) => ({ ...current, instances: current.instances.filter((instance) => instance.id !== selected.id) })); setSelectedId(undefined); }}><Trash2 size={15} /> 삭제</button></section>
          </> : <div className="inspector-empty"><RotateCw /><h2>배치된 오브젝트 선택</h2><p>오브젝트를 클릭하면 정확한 위치·회전·복제·재편집 기능이 표시됩니다.</p></div>}
        </aside>
      </section>
    </main>
  );
}
