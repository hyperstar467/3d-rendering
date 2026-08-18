"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  BoxSelect,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileBox,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Maximize2,
  Move3d,
  PackagePlus,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  BoothSettings,
  FaceTextureSettings,
  Fixture,
  FixtureCategory,
  FixtureFace,
  ModelRotation,
  ProjectData,
  ViewPreset,
  WallSide,
} from "@/lib/types";
import { DEFAULT_FACE_TEXTURE } from "@/lib/types";
import { clampFixturePlacement } from "@/lib/placement";
import { downloadPortableProject, readPortableProject } from "@/lib/projectArchive";

const BoothScene = dynamic(() => import("./BoothScene").then((module) => module.BoothScene), {
  ssr: false,
  loading: () => <div className="scene-loader"><LoaderCircle className="spin" /> 3D 공간을 준비하고 있어요</div>,
});

const ModelReview = dynamic(() => import("./ModelReview").then((module) => module.ModelReview), {
  ssr: false,
  loading: () => <div className="review-loading"><LoaderCircle className="spin" /> GLB 검수 화면을 준비하고 있어요</div>,
});

const PhotoFixtureReview = dynamic(() => import("./PhotoFixtureReview").then((module) => module.PhotoFixtureReview), {
  ssr: false,
  loading: () => <div className="review-loading"><LoaderCircle className="spin" /> 사진 집기 검수 화면을 준비하고 있어요</div>,
});

const DEFAULT_BOOTH: BoothSettings = {
  width: 6000,
  depth: 4000,
  height: 2500,
  wallMode: "three",
  wallColor: "#f1eee7",
  floorColor: "#454847",
  floorMaterial: "dark-carpet",
  showGrid: true,
  wallImages: {},
};

const CATEGORY_LABELS: Record<FixtureCategory, string> = {
  display: "진열대",
  counter: "카운터",
  table: "테이블",
  shelf: "선반",
  showcase: "쇼케이스",
  plinth: "전시 포디움",
  chair: "의자",
  stool: "스툴",
  sofa: "소파",
  rack: "행거 / 랙",
  partition: "파티션",
  banner: "배너 / POP",
  custom: "기타 집기",
};

const CATEGORY_COLORS: Record<FixtureCategory, string> = {
  display: "#ff8a5b",
  counter: "#325f50",
  table: "#d7a94f",
  shelf: "#a77856",
  showcase: "#749b9b",
  plinth: "#e3ddd3",
  chair: "#7e927f",
  stool: "#b47a55",
  sofa: "#7186a5",
  rack: "#545a5a",
  partition: "#d8d2c8",
  banner: "#6583c1",
  custom: "#7f746b",
};

const PRIMITIVE_PRESETS: Record<FixtureCategory, { name: string; width: number; depth: number; height: number }> = {
  display: { name: "제품 진열대", width: 1200, depth: 450, height: 1800 },
  counter: { name: "상담 카운터", width: 1400, depth: 600, height: 950 },
  table: { name: "체험 테이블", width: 1500, depth: 700, height: 760 },
  shelf: { name: "상품 선반", width: 1000, depth: 400, height: 1700 },
  showcase: { name: "유리 쇼케이스", width: 1200, depth: 500, height: 1100 },
  plinth: { name: "전시 포디움", width: 600, depth: 600, height: 900 },
  chair: { name: "상담 의자", width: 500, depth: 520, height: 820 },
  stool: { name: "체험 스툴", width: 400, depth: 400, height: 450 },
  sofa: { name: "2인 소파", width: 1500, depth: 700, height: 780 },
  rack: { name: "이동식 행거", width: 1200, depth: 500, height: 1700 },
  partition: { name: "공간 파티션", width: 1200, depth: 100, height: 2000 },
  banner: { name: "홍보 배너", width: 700, depth: 350, height: 1900 },
  custom: { name: "사용자 도형", width: 1000, depth: 1000, height: 1000 },
};

const FLOOR_MATERIALS: Array<{ id: BoothSettings["floorMaterial"]; label: string; color: string; className: string }> = [
  { id: "dark-carpet", label: "진회색 카펫", color: "#454847", className: "dark-carpet" },
  { id: "light-carpet", label: "연회색 카펫", color: "#a9aaa6", className: "light-carpet" },
  { id: "concrete", label: "콘크리트", color: "#a2a4a2", className: "concrete" },
  { id: "gray-tile", label: "회색 타일", color: "#8c918f", className: "gray-tile" },
  { id: "white-tile", label: "백색 타일", color: "#deded8", className: "white-tile" },
  { id: "wood", label: "우드 데크", color: "#a77e57", className: "wood" },
];

const FACE_LABELS: Record<FixtureFace, string> = { front: "정면", left: "좌측", right: "우측", back: "후면" };
const WALL_LABELS: Record<WallSide, string> = { back: "후면 벽", left: "좌측 벽", right: "우측 벽" };
const FACES = Object.keys(FACE_LABELS) as FixtureFace[];
const WALLS = Object.keys(WALL_LABELS) as WallSide[];

type Notice = { kind: "success" | "error" | "info"; message: string } | null;
type ModalMode = "photo" | "glb" | null;
type BasicDraft = Pick<Fixture, "name" | "category" | "width" | "depth" | "height" | "color">;
type PhotoDraft = BasicDraft & { faceTextures: Record<FixtureFace, FaceTextureSettings> };
type GlbDraft = BasicDraft & { modelUrl?: string; modelRotation: ModelRotation };

function makeFaceTextures(): Record<FixtureFace, FaceTextureSettings> {
  return {
    front: { ...DEFAULT_FACE_TEXTURE },
    left: { ...DEFAULT_FACE_TEXTURE },
    right: { ...DEFAULT_FACE_TEXTURE },
    back: { ...DEFAULT_FACE_TEXTURE },
  };
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `fixture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function positiveNumber(value: number, fallback = 1) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function fitSurfaceImage(file: File, surfaceWidth: number, surfaceHeight: number) {
  const source = await createImageBitmap(file);
  const aspect = surfaceWidth / Math.max(surfaceHeight, 1);
  const maxTextureSize = 2048;
  const width = aspect >= 1 ? maxTextureSize : Math.max(1, Math.round(maxTextureSize * aspect));
  const height = aspect >= 1 ? Math.max(1, Math.round(maxTextureSize / aspect)) : maxTextureSize;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    source.close();
    throw new Error("이미지를 변환하지 못했습니다.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  source.close();
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.94);
}

function Field({ label, unit, children }: { label: string; unit?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">{children}{unit && <small>{unit}</small>}</div>
    </label>
  );
}

export function Planner() {
  const [booth, setBooth] = useState<BoothSettings>(DEFAULT_BOOTH);
  const [boothDraft, setBoothDraft] = useState({ width: "6000", depth: "4000", height: "2500" });
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewPreset>("perspective");
  const [snap, setSnap] = useState(100);
  const [projectName, setProjectName] = useState("펫페어 공간 기획");
  const [activePanel, setActivePanel] = useState<"space" | "fixture">("space");
  const [notice, setNotice] = useState<Notice>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [basicDraft, setBasicDraft] = useState<BasicDraft>({
    ...PRIMITIVE_PRESETS.display,
    category: "display",
    color: CATEGORY_COLORS.display,
  });
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft>({
    name: "사진 집기",
    category: "custom",
    width: 1200,
    depth: 450,
    height: 1800,
    color: "#d9d2c7",
    faceTextures: makeFaceTextures(),
  });
  const [glbDraft, setGlbDraft] = useState<GlbDraft>({
    name: "GLB 집기",
    category: "custom",
    width: 1200,
    depth: 450,
    height: 1800,
    color: "#d9d2c7",
    modelRotation: { x: 0, y: 0, z: 0 },
  });
  const projectInput = useRef<HTMLInputElement>(null);
  const glbInput = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => fixtures.find((fixture) => fixture.id === selectedId) ?? null, [fixtures, selectedId]);
  const occupiedArea = useMemo(() => fixtures.reduce((total, fixture) => total + fixture.width * fixture.depth, 0), [fixtures]);
  const boothArea = booth.width * booth.depth;
  const occupancy = boothArea ? Math.min(100, Math.round((occupiedArea / boothArea) * 100)) : 0;
  const isBoothDirty = boothDraft.width !== String(booth.width) || boothDraft.depth !== String(booth.depth) || boothDraft.height !== String(booth.height);

  useEffect(() => {
    const timer = notice ? window.setTimeout(() => setNotice(null), 5000) : undefined;
    return () => { if (timer) window.clearTimeout(timer); };
  }, [notice]);

  useEffect(() => {
    if (!selected || modalMode) return;
    const selectedFixture = selected;
    function handleFixtureDelete(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      const isDeleteKey = event.key === "Delete" || event.key.toLowerCase() === "x";
      if (isEditing || !isDeleteKey || event.repeat) return;
      event.preventDefault();
      setFixtures((items) => items.filter((item) => item.id !== selectedFixture.id));
      setSelectedId(null);
      setNotice({ kind: "info", message: `${selectedFixture.name}을(를) 삭제했습니다.` });
    }
    window.addEventListener("keydown", handleFixtureDelete);
    return () => window.removeEventListener("keydown", handleFixtureDelete);
  }, [modalMode, selected]);

  const moveFixture = useCallback((id: string, x: number, z: number) => {
    setFixtures((items) => items.map((fixture) => {
      if (fixture.id !== id) return fixture;
      const placement = clampFixturePlacement(fixture, booth, x, z);
      return placement.fits ? { ...fixture, x: placement.x, z: placement.z } : fixture;
    }));
  }, [booth]);

  function addFixture(fixture: Omit<Fixture, "id" | "x" | "z" | "rotation">) {
    if (![fixture.width, fixture.depth, fixture.height].every((value) => Number.isFinite(value) && value > 0)) {
      setNotice({ kind: "error", message: "집기 W/D/H는 0보다 커야 합니다." });
      return false;
    }
    const candidate: Fixture = { ...fixture, id: uid(), x: 0, z: 0, rotation: 0 };
    const placement = clampFixturePlacement(candidate, booth, 0, 0);
    if (!placement.fits) {
      setNotice({ kind: "error", message: placement.message });
      return false;
    }
    candidate.x = placement.x;
    candidate.z = placement.z;
    setFixtures((items) => [...items, candidate]);
    setSelectedId(candidate.id);
    setModalMode(null);
    setNotice({ kind: "success", message: `${fixture.name}을(를) 실측 크기로 부스에 추가했습니다.` });
    return true;
  }

  function updateFixture(id: string, patch: Partial<Fixture>) {
    const current = fixtures.find((fixture) => fixture.id === id);
    if (!current) return;
    const candidate = { ...current, ...patch };
    if (![candidate.width, candidate.depth, candidate.height].every((value) => Number.isFinite(value) && value > 0)) {
      setNotice({ kind: "error", message: "집기 W/D/H는 0보다 커야 합니다." });
      return;
    }
    const placement = clampFixturePlacement(candidate, booth, candidate.x, candidate.z);
    if (!placement.fits) {
      setNotice({ kind: "error", message: placement.message });
      return;
    }
    setFixtures((items) => items.map((fixture) => fixture.id === id ? { ...candidate, x: placement.x, z: placement.z } : fixture));
  }

  function duplicateSelected() {
    if (!selected) return;
    const clone = { ...selected, id: uid(), name: `${selected.name} 복사본` };
    const placement = clampFixturePlacement(clone, booth, clone.x + snap, clone.z + snap);
    if (!placement.fits) {
      setNotice({ kind: "error", message: placement.message });
      return;
    }
    setFixtures((items) => [...items, { ...clone, x: placement.x, z: placement.z }]);
    setSelectedId(clone.id);
  }

  function removeSelected() {
    if (!selected) return;
    setFixtures((items) => items.filter((item) => item.id !== selected.id));
    setSelectedId(null);
    setNotice({ kind: "info", message: `${selected.name}을(를) 삭제했습니다.` });
  }

  function updateBoothDraft(key: "width" | "depth" | "height", value: string) {
    if (/^\d*$/.test(value)) setBoothDraft((current) => ({ ...current, [key]: value }));
  }

  function applyBoothDimensions() {
    const nextBooth = { ...booth, width: Number(boothDraft.width), depth: Number(boothDraft.depth), height: Number(boothDraft.height) };
    if (![nextBooth.width, nextBooth.depth, nextBooth.height].every((value) => Number.isFinite(value) && value > 0)) {
      setNotice({ kind: "error", message: "가로, 깊이, 높이를 0보다 큰 숫자로 모두 입력해 주세요." });
      return;
    }
    const placements = fixtures.map((fixture) => clampFixturePlacement(fixture, nextBooth, fixture.x, fixture.z));
    const invalid = placements.find((placement) => !placement.fits);
    if (invalid && !invalid.fits) {
      setNotice({ kind: "error", message: `부스 크기를 적용할 수 없습니다. ${invalid.message}` });
      return;
    }
    setFixtures((items) => items.map((fixture, index) => {
      const placement = placements[index];
      return placement.fits ? { ...fixture, x: placement.x, z: placement.z } : fixture;
    }));
    setBooth(nextBooth);
    setNotice({ kind: "success", message: `부스 크기를 ${nextBooth.width} × ${nextBooth.depth} × ${nextBooth.height} mm로 적용했습니다.` });
  }

  function resetProject() {
    setBooth(DEFAULT_BOOTH);
    setBoothDraft({ width: "6000", depth: "4000", height: "2500" });
    setFixtures([]);
    setSelectedId(null);
    setProjectName("펫페어 공간 기획");
    setNotice({ kind: "info", message: "집기가 없는 새 부스로 초기화했습니다." });
  }

  function saveProject() {
    const data: ProjectData = { version: 2, name: projectName, booth, fixtures, savedAt: new Date().toISOString() };
    downloadPortableProject(data, projectName);
    setNotice({ kind: "success", message: "모든 이미지와 GLB를 포함한 portable .pawplan 파일을 저장했습니다." });
  }

  async function loadProject(file: File) {
    try {
      const data = await readPortableProject(file);
      const loadedBooth = { ...DEFAULT_BOOTH, ...data.booth, wallImages: data.booth.wallImages ?? {} };
      const placements = data.fixtures.map((fixture) => clampFixturePlacement(fixture, loadedBooth, fixture.x, fixture.z));
      const invalid = placements.find((placement) => !placement.fits);
      if (invalid && !invalid.fits) throw new Error(invalid.message);
      const restoredFixtures = data.fixtures.map((fixture, index) => {
        const placement = placements[index];
        return placement.fits ? { ...fixture, x: placement.x, z: placement.z } : fixture;
      });
      setProjectName(data.name || "불러온 프로젝트");
      setBooth(loadedBooth);
      setBoothDraft({ width: String(loadedBooth.width), depth: String(loadedBooth.depth), height: String(loadedBooth.height) });
      setFixtures(restoredFixtures);
      setSelectedId(restoredFixtures[0]?.id ?? null);
      setNotice({ kind: "success", message: "프로젝트와 포함된 모든 자산을 복원했습니다." });
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "올바른 PawPlan 프로젝트 파일이 아닙니다." });
    } finally {
      if (projectInput.current) projectInput.current.value = "";
    }
  }

  function setSurfaceValue(target: "floor" | WallSide, value?: string) {
    setBooth((current) => target === "floor"
      ? { ...current, floorImage: value }
      : { ...current, wallImages: { ...current.wallImages, [target]: value } });
  }

  async function applySurfaceImage(target: "floor" | WallSide, file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setNotice({ kind: "error", message: "PNG, JPG, WEBP 이미지를 8MB 이하로 선택해 주세요." });
      return;
    }
    const width = target === "floor" || target === "back" ? booth.width : booth.depth;
    const height = target === "floor" ? booth.depth : booth.height;
    try {
      const dataUrl = await fitSurfaceImage(file, width, height);
      setSurfaceValue(target, dataUrl);
      setNotice({ kind: "success", message: `${target === "floor" ? "바닥" : WALL_LABELS[target]} 이미지를 ${width} × ${height} mm 비율로 적용했습니다.` });
    } catch {
      setNotice({ kind: "error", message: "마감 이미지를 읽지 못했습니다." });
    }
  }

  async function applyFaceImage(face: FixtureFace, file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setNotice({ kind: "error", message: "집기 사진은 PNG, JPG, WEBP 형식의 8MB 이하 파일이어야 합니다." });
      return;
    }
    try {
      const image = await fileToDataUrl(file);
      setPhotoDraft((current) => ({
        ...current,
        faceTextures: { ...current.faceTextures, [face]: { ...current.faceTextures[face], image } },
      }));
    } catch {
      setNotice({ kind: "error", message: `${FACE_LABELS[face]} 사진을 읽지 못했습니다.` });
    }
  }

  function updateFaceSettings(face: FixtureFace, patch: Partial<FaceTextureSettings>) {
    setPhotoDraft((current) => ({
      ...current,
      faceTextures: { ...current.faceTextures, [face]: { ...current.faceTextures[face], ...patch } },
    }));
  }

  async function handleGlbFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb") || file.size > 50 * 1024 * 1024) {
      setNotice({ kind: "error", message: "50MB 이하의 GLB 파일을 선택해 주세요." });
      return;
    }
    try {
      const modelUrl = await fileToDataUrl(file);
      setGlbDraft((current) => ({ ...current, name: file.name.replace(/\.glb$/i, "") || current.name, modelUrl }));
      setNotice({ kind: "success", message: "GLB를 불러왔습니다. 실측 BoundingBox를 검수해 주세요." });
    } catch {
      setNotice({ kind: "error", message: "GLB 파일을 읽지 못했습니다." });
    }
  }

  function rotateGlb(axis: keyof ModelRotation, delta: number) {
    setGlbDraft((current) => ({
      ...current,
      modelRotation: { ...current.modelRotation, [axis]: (current.modelRotation[axis] + delta + 360) % 360 },
    }));
  }

  function updateBasicCategory(category: FixtureCategory) {
    setBasicDraft({ ...PRIMITIVE_PRESETS[category], category, color: CATEGORY_COLORS[category] });
  }

  const photoPreviewFixture: Pick<Fixture, "width" | "depth" | "height" | "color" | "faceTextures"> = photoDraft;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><BoxSelect size={22} /></div><div><strong>PawPlan</strong><span>MEASURED SPACE STUDIO</span></div></div>
        <div className="project-title"><span className="live-dot" /><input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="프로젝트 이름" /><ChevronDown size={15} /></div>
        <div className="top-actions">
          <button className="button ghost" onClick={resetProject}>새 프로젝트</button>
          <input ref={projectInput} type="file" accept=".pawplan,.json,application/zip,application/json" hidden onChange={(event) => event.target.files?.[0] && loadProject(event.target.files[0])} />
          <button className="button ghost" onClick={() => projectInput.current?.click()}><Upload size={16} /> 불러오기</button>
          <button className="button dark" onClick={saveProject}><Save size={16} /> .pawplan 저장</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="left-panel">
          <div className="panel-tabs">
            <button className={activePanel === "space" ? "active" : ""} onClick={() => setActivePanel("space")}><Maximize2 size={16} /> 공간</button>
            <button className={activePanel === "fixture" ? "active" : ""} onClick={() => setActivePanel("fixture")}><PackagePlus size={16} /> 집기</button>
          </div>

          {activePanel === "space" ? (
            <div className="panel-content">
              <div className="section-heading"><div><span className="eyebrow">SPACE 01</span><h2>부스 실측 설정</h2></div><span className="unit-badge">mm 입력</span></div>
              <p className="help-text">치수를 모두 입력한 뒤 적용을 누르면 3D 공간이 한 번에 변경됩니다.</p>
              <div className="dimension-grid">
                <Field label="가로 W" unit="mm"><input type="text" inputMode="numeric" value={boothDraft.width} onChange={(e) => updateBoothDraft("width", e.target.value)} /></Field>
                <Field label="깊이 D" unit="mm"><input type="text" inputMode="numeric" value={boothDraft.depth} onChange={(e) => updateBoothDraft("depth", e.target.value)} /></Field>
                <Field label="높이 H" unit="mm"><input type="text" inputMode="numeric" value={boothDraft.height} onChange={(e) => updateBoothDraft("height", e.target.value)} /></Field>
              </div>
              <button className={`button full apply-dimensions ${isBoothDirty ? "dirty" : ""}`} onClick={applyBoothDimensions}><Check size={16} /> {isBoothDirty ? "입력한 부스 크기 적용" : "현재 부스 크기 적용됨"}</button>

              <div className="control-section"><label className="control-label">벽 구성</label><div className="segmented three">{(["three", "back", "none"] as const).map((mode) => <button key={mode} className={booth.wallMode === mode ? "active" : ""} onClick={() => setBooth({ ...booth, wallMode: mode })}>{mode === "three" ? "3면" : mode === "back" ? "1면" : "없음"}</button>)}</div></div>

              <div className="control-section"><div className="label-row"><label className="control-label">기본 바닥재</label><span className="surface-caption">공간기획 표준</span></div><div className="floor-material-grid">{FLOOR_MATERIALS.map((material) => <button key={material.id} className={booth.floorMaterial === material.id && !booth.floorImage ? "active" : ""} onClick={() => setBooth({ ...booth, floorMaterial: material.id, floorColor: material.color, floorImage: undefined })}><i className={material.className} style={{ "--floor-color": material.color } as CSSProperties} /><span>{material.label}</span></button>)}</div></div>

              <div className="control-section surface-controls">
                <div className="color-row"><Field label="바닥 직접 색상"><input className="color-input" type="color" value={booth.floorColor} onChange={(e) => setBooth({ ...booth, floorColor: e.target.value, floorMaterial: "custom", floorImage: undefined })} /></Field><Field label="벽 기본 색상"><input className="color-input" type="color" value={booth.wallColor} onChange={(e) => setBooth({ ...booth, wallColor: e.target.value })} /></Field></div>
                <div className="surface-upload-grid">
                  <div className={`surface-upload-card ${booth.floorImage ? "has-image" : ""}`}>{booth.floorImage && <img src={booth.floorImage} alt="바닥 마감" />}<div><strong>바닥</strong><small>{booth.width} × {booth.depth} mm</small></div><label className="button outline"><Upload size={14} /> 업로드<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && applySurfaceImage("floor", e.target.files[0])} /></label>{booth.floorImage && <button className="surface-remove" onClick={() => setSurfaceValue("floor", undefined)} aria-label="바닥 이미지 제거"><X size={13} /></button>}</div>
                  {WALLS.map((wall) => {
                    const image = booth.wallImages[wall];
                    const wallWidth = wall === "back" ? booth.width : booth.depth;
                    return <div key={wall} className={`surface-upload-card ${image ? "has-image" : ""}`}>{image && <img src={image} alt={`${WALL_LABELS[wall]} 마감`} />}<div><strong>{WALL_LABELS[wall]}</strong><small>{wallWidth} × {booth.height} mm</small></div><label className="button outline"><Upload size={14} /> 업로드<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && applySurfaceImage(wall, e.target.files[0])} /></label>{image && <button className="surface-remove" onClick={() => setSurfaceValue(wall, undefined)} aria-label={`${WALL_LABELS[wall]} 이미지 제거`}><X size={13} /></button>}</div>;
                  })}
                </div>
              </div>

              <div className="control-section display-options"><div><label className="control-label">바닥 격자 표시</label><small>실제 부스 영역 안의 500mm 격자</small></div><button className={`toggle ${booth.showGrid ? "on" : ""}`} role="switch" aria-checked={booth.showGrid} onClick={() => setBooth({ ...booth, showGrid: !booth.showGrid })}><i /></button></div>
              <div className="control-section"><label className="control-label">이동 스냅</label><div className="segmented three">{[50, 100, 250].map((value) => <button key={value} className={snap === value ? "active" : ""} onClick={() => setSnap(value)}>{value} mm</button>)}</div></div>
              <div className="summary-card"><div><span>부스 면적</span><strong>{(boothArea / 1_000_000).toFixed(1)} m²</strong></div><div><span>집기 점유율</span><strong>{occupancy}%</strong></div><div className="meter"><i style={{ width: `${occupancy}%` }} /></div><small>동선 확보를 위해 55% 이하를 권장합니다.</small></div>
            </div>
          ) : (
            <div className="panel-content">
              <div className="section-heading"><div><span className="eyebrow">FIXTURE 02</span><h2>실측 집기 추가</h2></div><span className="unit-badge">로컬 전용</span></div>
              <p className="help-text primitive-help">외부 API 없이 기본 도형, 면별 사진 Box 또는 직접 업로드한 GLB를 등록합니다.</p>
              <div className="primitive-grid">{(Object.keys(CATEGORY_LABELS) as FixtureCategory[]).map((category) => <button key={category} className={basicDraft.category === category ? "active" : ""} onClick={() => updateBasicCategory(category)}><Box size={16} /><span>{CATEGORY_LABELS[category]}</span></button>)}</div>
              <div className="primitive-form">
                <Field label="집기 이름"><input value={basicDraft.name} onChange={(e) => setBasicDraft({ ...basicDraft, name: e.target.value })} /></Field>
                <div className="dimension-grid">{(["width", "depth", "height"] as const).map((key) => <Field key={key} label={key === "width" ? "W" : key === "depth" ? "D" : "H"} unit="mm"><input type="number" step="10" value={basicDraft[key]} onChange={(e) => setBasicDraft({ ...basicDraft, [key]: positiveNumber(+e.target.value) })} /></Field>)}</div>
                <div className="primitive-color-action"><Field label="색상"><input className="color-input" type="color" value={basicDraft.color} onChange={(e) => setBasicDraft({ ...basicDraft, color: e.target.value })} /></Field><button className="button dark" onClick={() => addFixture({ ...basicDraft, source: "primitive" })}><PackagePlus size={16} /> 부스에 추가</button></div>
              </div>

              <div className="panel-divider"><span>사진 또는 GLB</span></div>
              <div className="local-asset-actions">
                <button className="asset-card photo-card" onClick={() => setModalMode("photo")}><span className="asset-icon"><ImagePlus size={21} /></span><span><strong>면별 사진 집기</strong><small>정면·좌·우·후면을 실측 Box에 적용</small></span></button>
                <button className="asset-card" onClick={() => setModalMode("glb")}><span className="asset-icon"><FileBox size={21} /></span><span><strong>GLB 직접 등록</strong><small>방향과 W/D/H BoundingBox 검수</small></span></button>
              </div>
              <div className="library-heading"><span>배치된 집기</span><strong>{fixtures.length}</strong></div>
              <div className="fixture-list">{!fixtures.length && <div className="empty-fixture-list"><BoxSelect size={21} /><span>아직 배치된 집기가 없습니다.</span></div>}{fixtures.map((fixture, index) => <button key={fixture.id} className={`fixture-row ${selectedId === fixture.id ? "selected" : ""}`} onClick={() => setSelectedId(fixture.id)}><span className="fixture-index">{String(index + 1).padStart(2, "0")}</span><span className="fixture-swatch" style={{ background: fixture.color }}><Box size={18} /></span><span className="fixture-copy"><strong>{fixture.name}</strong><small>{fixture.width} × {fixture.depth} × {fixture.height} mm</small></span>{fixture.source === "photo" && <span className="glb-badge">PHOTO</span>}{fixture.source === "upload" && <span className="glb-badge">GLB</span>}</button>)}</div>
            </div>
          )}
        </aside>

        <section className="scene-area">
          <div className="scene-toolbar"><div className="view-switcher">{(["perspective", "top", "front"] as ViewPreset[]).map((preset) => <button key={preset} className={view === preset ? "active" : ""} onClick={() => setView(preset)}>{preset === "perspective" ? <><Camera size={15} /> 원근</> : preset === "top" ? <><Layers3 size={15} /> 평면</> : <><Box size={15} /> 정면</>}</button>)}</div><div className="scene-stats"><span>{(booth.width / 1000).toFixed(1)} × {(booth.depth / 1000).toFixed(1)} m</span><i /><span>스냅 {snap} mm</span></div></div>
          <div className="canvas-wrap"><BoothScene booth={booth} fixtures={fixtures} selectedId={selectedId} view={view} snap={snap} onSelect={setSelectedId} onMove={moveFixture} /><div className="canvas-hint"><Move3d size={16} /><span><strong>잡은 위치를 유지</strong>해 드래그하며 카메라는 자동 잠금됩니다.</span><span className="keyboard-hint"><kbd>X</kbd><span>/</span><kbd>Del</kbd> 선택 삭제</span></div><div className="axis-widget"><span className="axis-y">Y</span><span className="axis-x">X</span><span className="axis-z">Z</span><i /></div></div>
        </section>

        <aside className="right-panel">
          {selected ? (
            <div className="inspector">
              <div className="section-heading inspector-heading"><div><span className="eyebrow">SELECTED OBJECT</span><h2>{selected.name}</h2></div><button className="icon-button" onClick={() => setSelectedId(null)} aria-label="선택 해제"><X size={18} /></button></div>
              <div className="object-preview" style={{ "--object-color": selected.color } as CSSProperties}><Box size={54} strokeWidth={1.2} /><span>{selected.source === "upload" ? "LOCAL GLB" : selected.source === "photo" ? "PHOTO TEXTURED BOX" : CATEGORY_LABELS[selected.category]}</span></div>
              <div className="control-section"><Field label="이름"><input value={selected.name} onChange={(e) => updateFixture(selected.id, { name: e.target.value })} /></Field></div>
              <div className="dimension-grid inspector-dimensions">{(["width", "depth", "height"] as const).map((key) => <Field key={key} label={key === "width" ? "W" : key === "depth" ? "D" : "H"} unit="mm"><input type="number" step="10" value={selected[key]} onChange={(e) => updateFixture(selected.id, { [key]: +e.target.value })} /></Field>)}</div>
              <p className="microcopy">W/D/회전 변경 시 footprint를 다시 계산하고 부스 안으로 위치를 자동 보정합니다.</p>
              <div className="control-section"><label className="control-label">위치</label><div className="position-grid"><Field label="X" unit="mm"><input type="number" step={snap} value={Math.round(selected.x)} onChange={(e) => moveFixture(selected.id, +e.target.value, selected.z)} /></Field><Field label="Z" unit="mm"><input type="number" step={snap} value={Math.round(selected.z)} onChange={(e) => moveFixture(selected.id, selected.x, +e.target.value)} /></Field></div></div>
              <div className="control-section"><div className="label-row"><label className="control-label">회전</label><output>{selected.rotation}°</output></div><input className="range" type="range" min="-180" max="180" step="5" value={selected.rotation} onChange={(e) => updateFixture(selected.id, { rotation: +e.target.value })} /><div className="rotation-buttons">{[-90, -45, 0, 45, 90].map((angle) => <button key={angle} className={selected.rotation === angle ? "active" : ""} onClick={() => updateFixture(selected.id, { rotation: angle })}>{angle}°</button>)}</div></div>
              <div className="control-section color-row single-color"><Field label="오브젝트 색상"><input className="color-input" type="color" value={selected.color} onChange={(e) => updateFixture(selected.id, { color: e.target.value })} /></Field></div>
              <div className="inspector-actions"><button className="button outline" onClick={duplicateSelected}><Copy size={16} /> 복제</button><button className="button danger" onClick={removeSelected} aria-keyshortcuts="Delete X"><Trash2 size={16} /> 삭제</button></div>
              {selected.modelUrl && <a className="download-link" href={selected.modelUrl} download={`${selected.name}.glb`}><Download size={15} /> 포함된 GLB 다운로드</a>}
            </div>
          ) : (
            <div className="empty-inspector"><span><BoxSelect size={32} /></span><h2>{fixtures.length ? "집기를 선택하세요" : "빈 부스에서 시작합니다"}</h2><p>{fixtures.length ? "3D 공간이나 목록에서 집기를 선택해 편집하세요." : "기본 도형, 면별 사진 Box 또는 GLB를 실측 크기로 등록할 수 있습니다."}</p><div className="empty-actions"><button className="button outline" onClick={() => setActivePanel("fixture")}><Box size={16} /> 기본 도형</button><button className="button dark" onClick={() => setModalMode("photo")}><ImagePlus size={16} /> 사진 집기</button></div></div>
          )}
        </aside>
      </section>

      <footer className="statusbar"><span><i className="status-ok"><Check size={10} /></i> 편집 가능</span><span>오브젝트 {fixtures.length}</span><span>점유 면적 {(occupiedArea / 1_000_000).toFixed(2)} m²</span><span className="status-tip">UI 입력: mm · Three.js 내부: 1 unit = 1 meter</span></footer>
      {notice && <div className={`toast ${notice.kind}`}>{notice.kind === "success" ? <Check size={17} /> : notice.kind === "error" ? <X size={17} /> : <Sparkles size={17} />}{notice.message}</div>}

      {modalMode === "photo" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModalMode(null)}>
          <section className="modal photo-fixture-modal" role="dialog" aria-modal="true" aria-labelledby="photo-fixture-title">
            <div className="modal-header"><div><span className="eyebrow">LOCAL PHOTO FIXTURE</span><h2 id="photo-fixture-title">면별 사진 실측 Box 검수</h2><p>사진이 없는 면은 지정 색상으로 표시됩니다. 별도 3D preview 확인 후에만 부스에 추가됩니다.</p></div><button className="icon-button" onClick={() => setModalMode(null)} aria-label="닫기"><X size={20} /></button></div>
            <div className="photo-review-body">
              <div className="review-stage"><PhotoFixtureReview fixture={photoPreviewFixture} /><div className="review-checklist"><span><Check size={13} /> Box 외곽 W/D/H는 입력 실측과 일치</span><span><Check size={13} /> 각 면 contain/cover와 위치를 독립 적용</span></div></div>
              <div className="photo-settings-panel">
                <div className="photo-core-fields"><Field label="집기 이름"><input value={photoDraft.name} onChange={(e) => setPhotoDraft({ ...photoDraft, name: e.target.value })} /></Field><Field label="분류"><select value={photoDraft.category} onChange={(e) => setPhotoDraft({ ...photoDraft, category: e.target.value as FixtureCategory })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><div className="dimension-grid">{(["width", "depth", "height"] as const).map((key) => <Field key={key} label={key.toUpperCase()} unit="mm"><input type="number" step="10" value={photoDraft[key]} onChange={(e) => setPhotoDraft({ ...photoDraft, [key]: positiveNumber(+e.target.value) })} /></Field>)}</div><Field label="사진 없는 면 색상"><input className="color-input" type="color" value={photoDraft.color} onChange={(e) => setPhotoDraft({ ...photoDraft, color: e.target.value })} /></Field></div>
                <div className="face-settings-list">{FACES.map((face) => {
                  const settings = photoDraft.faceTextures[face];
                  return <section key={face} className={`face-settings-card ${settings.image ? "has-image" : ""}`}><div className="face-card-header">{settings.image ? <img src={settings.image} alt={`${FACE_LABELS[face]} 사진`} /> : <span className="face-placeholder"><ImagePlus size={17} /></span>}<div><strong>{FACE_LABELS[face]} 사진</strong><small>{face === "front" || face === "back" ? `${photoDraft.width} × ${photoDraft.height}` : `${photoDraft.depth} × ${photoDraft.height}`} mm 면</small></div><label className="button outline"><Upload size={13} /> {settings.image ? "교체" : "선택"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && applyFaceImage(face, e.target.files[0])} /></label>{settings.image && <button className="surface-remove" onClick={() => updateFaceSettings(face, { image: undefined })} aria-label={`${FACE_LABELS[face]} 사진 제거`}><X size={12} /></button>}</div><div className="face-control-grid"><Field label="맞춤"><select aria-label={`${FACE_LABELS[face]} 맞춤`} value={settings.fit} onChange={(e) => updateFaceSettings(face, { fit: e.target.value as "contain" | "cover" })}><option value="contain">contain</option><option value="cover">cover</option></select></Field><Field label="회전"><input aria-label={`${FACE_LABELS[face]} 회전`} type="number" min="-180" max="180" step="1" value={settings.rotation} onChange={(e) => updateFaceSettings(face, { rotation: +e.target.value })} /></Field></div><label className="face-slider"><span>Zoom <output>{settings.zoom.toFixed(2)}×</output></span><input aria-label={`${FACE_LABELS[face]} zoom`} type="range" min="0.25" max="3" step="0.05" value={settings.zoom} onChange={(e) => updateFaceSettings(face, { zoom: +e.target.value })} /></label><label className="face-slider"><span>X position <output>{settings.x}%</output></span><input aria-label={`${FACE_LABELS[face]} X position`} type="range" min="-100" max="100" value={settings.x} onChange={(e) => updateFaceSettings(face, { x: +e.target.value })} /></label><label className="face-slider"><span>Y position <output>{settings.y}%</output></span><input aria-label={`${FACE_LABELS[face]} Y position`} type="range" min="-100" max="100" value={settings.y} onChange={(e) => updateFaceSettings(face, { y: +e.target.value })} /></label></section>;
                })}</div>
                <div className="review-actions"><button className="button outline" onClick={() => setPhotoDraft((current) => ({ ...current, faceTextures: makeFaceTextures() }))}><RotateCw size={16} /> 사진 초기화</button><button className="button dark" onClick={() => addFixture({ ...photoDraft, faceTextures: structuredClone(photoDraft.faceTextures), source: "photo" })}><Check size={17} /> 검수 후 부스에 추가</button></div>
              </div>
            </div>
          </section>
        </div>
      )}

      {modalMode === "glb" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModalMode(null)}>
          <section className="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="glb-fixture-title">
            <div className="modal-header"><div><span className="eyebrow">LOCAL GLB REVIEW</span><h2 id="glb-fixture-title">GLB 실측 BoundingBox 검수</h2><p>Orientation group을 먼저 적용하고 별도 Scale group에서 최종 W/D/H를 맞춥니다.</p></div><button className="icon-button" onClick={() => setModalMode(null)} aria-label="닫기"><X size={20} /></button></div>
            <div className="review-body"><div className="review-stage">{glbDraft.modelUrl ? <ModelReview modelUrl={glbDraft.modelUrl} width={glbDraft.width} depth={glbDraft.depth} height={glbDraft.height} rotation={glbDraft.modelRotation} /> : <button className="glb-empty-stage" onClick={() => glbInput.current?.click()}><FileBox size={35} /><strong>GLB 파일 선택</strong><span>최대 50MB · 프로젝트 파일에 포함됩니다.</span></button>}</div><div className="review-panel"><input ref={glbInput} type="file" accept=".glb,model/gltf-binary" hidden onChange={(event) => event.target.files?.[0] && handleGlbFile(event.target.files[0])} /><button className="button outline full" onClick={() => glbInput.current?.click()}><FileBox size={16} /> {glbDraft.modelUrl ? "GLB 교체" : "GLB 선택"}</button><Field label="집기 이름"><input value={glbDraft.name} onChange={(e) => setGlbDraft({ ...glbDraft, name: e.target.value })} /></Field><Field label="분류"><select value={glbDraft.category} onChange={(e) => setGlbDraft({ ...glbDraft, category: e.target.value as FixtureCategory })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><div><label className="control-label">최종 실측 크기</label><div className="dimension-grid">{(["width", "depth", "height"] as const).map((key) => <Field key={key} label={key.toUpperCase()} unit="mm"><input type="number" step="10" value={glbDraft[key]} onChange={(e) => setGlbDraft({ ...glbDraft, [key]: positiveNumber(+e.target.value) })} /></Field>)}</div></div><div className="orientation-control"><div className="label-row"><label className="control-label">Orientation group</label><button onClick={() => setGlbDraft({ ...glbDraft, modelRotation: { x: 0, y: 0, z: 0 } })}>초기화</button></div><div className="orientation-buttons">{(["x", "y", "z"] as const).map((axis) => <div key={axis}><span>{axis.toUpperCase()}축 {glbDraft.modelRotation[axis]}°</span><button onClick={() => rotateGlb(axis, -90)}>-90°</button><button onClick={() => rotateGlb(axis, 90)}>+90°</button></div>)}</div></div><p className="dimension-note"><Maximize2 size={15} /> Preview와 부스가 동일한 공통 scaling utility를 사용합니다.</p><div className="review-actions"><button className="button outline" onClick={() => setGlbDraft((current) => ({ ...current, modelUrl: undefined }))}><RotateCw size={16} /> 다시 선택</button><button className="button dark" disabled={!glbDraft.modelUrl} onClick={() => glbDraft.modelUrl && addFixture({ name: glbDraft.name, category: glbDraft.category, width: glbDraft.width, depth: glbDraft.depth, height: glbDraft.height, color: glbDraft.color, modelUrl: glbDraft.modelUrl, modelRotation: glbDraft.modelRotation, source: "upload" })}><Check size={17} /> 검수 후 부스에 추가</button></div></div></div>
          </section>
        </div>
      )}
    </main>
  );
}
