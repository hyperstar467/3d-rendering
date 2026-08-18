"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  WandSparkles,
  X,
} from "lucide-react";
import type {
  BoothSettings,
  Fixture,
  FixtureCategory,
  MeshyTask,
  ProjectData,
  ViewPreset,
} from "@/lib/types";

const BoothScene = dynamic(() => import("./BoothScene").then((module) => module.BoothScene), {
  ssr: false,
  loading: () => <div className="scene-loader"><LoaderCircle className="spin" /> 3D 공간을 준비하고 있어요</div>,
});

const ModelReview = dynamic(() => import("./ModelReview").then((module) => module.ModelReview), {
  ssr: false,
  loading: () => <div className="review-loading"><LoaderCircle className="spin" /> 검수 화면을 준비하고 있어요</div>,
});

const DEFAULT_BOOTH: BoothSettings = {
  width: 6000,
  depth: 4000,
  height: 2800,
  wallMode: "three",
  wallColor: "#f1eee7",
  floorColor: "#454847",
  floorMaterial: "dark-carpet",
  showGrid: true,
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

type Notice = { kind: "success" | "error" | "info"; message: string } | null;
type GenerationState = { status: string; progress: number; taskId?: string } | null;
type GeneratedAsset = {
  modelUrl: string;
  thumbnailUrl?: string;
  source: "meshy" | "upload";
  taskId?: string;
} | null;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `fixture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
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
    throw new Error("이미지 변환을 준비하지 못했습니다.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  source.close();
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.94);
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Field({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        {children}
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
}

export function Planner() {
  const [booth, setBooth] = useState<BoothSettings>(DEFAULT_BOOTH);
  const [boothDraft, setBoothDraft] = useState({
    width: String(DEFAULT_BOOTH.width),
    depth: String(DEFAULT_BOOTH.depth),
    height: String(DEFAULT_BOOTH.height),
  });
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewPreset>("perspective");
  const [snap, setSnap] = useState(100);
  const [projectName, setProjectName] = useState("2026 서울 펫페어 · A-14");
  const [activePanel, setActivePanel] = useState<"space" | "fixture">("space");
  const [notice, setNotice] = useState<Notice>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [generation, setGeneration] = useState<GenerationState>(null);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset>(null);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [draft, setDraft] = useState({
    name: "신규 집기",
    category: "display" as FixtureCategory,
    width: 1200,
    depth: 450,
    height: 1800,
    color: CATEGORY_COLORS.display,
    modelRotation: { x: 0, y: 0, z: 0 },
  });
  const projectInput = useRef<HTMLInputElement>(null);
  const glbInput = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedId) ?? null,
    [fixtures, selectedId],
  );

  const occupiedArea = useMemo(
    () => fixtures.reduce((total, fixture) => total + fixture.width * fixture.depth, 0),
    [fixtures],
  );
  const boothArea = booth.width * booth.depth;
  const occupancy = boothArea ? Math.min(100, Math.round((occupiedArea / boothArea) * 100)) : 0;
  const isBoothDirty =
    boothDraft.width !== String(booth.width) ||
    boothDraft.depth !== String(booth.depth) ||
    boothDraft.height !== String(booth.height);

  useEffect(() => {
    const timer = notice ? window.setTimeout(() => setNotice(null), 4200) : undefined;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [notice]);

  useEffect(() => {
    if (!selected || showAiModal) return;
    const selectedFixture = selected;

    function handleFixtureDelete(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      const isDeleteKey = event.key === "Delete" || event.key.toLowerCase() === "x";

      if (isEditing || !isDeleteKey || event.repeat) return;
      event.preventDefault();
      setFixtures((items) => items.filter((item) => item.id !== selectedFixture.id));
      setSelectedId(null);
      setNotice({ kind: "info", message: `${selectedFixture.name}을(를) 삭제했습니다.` });
    }

    window.addEventListener("keydown", handleFixtureDelete);
    return () => window.removeEventListener("keydown", handleFixtureDelete);
  }, [selected, showAiModal]);

  const updateFixture = useCallback((id: string, patch: Partial<Fixture>) => {
    setFixtures((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const clampFixtureToBooth = useCallback(
    (fixture: Fixture, x: number, z: number) => {
      const radians = (fixture.rotation * Math.PI) / 180;
      const halfX = (Math.abs(Math.cos(radians)) * fixture.width + Math.abs(Math.sin(radians)) * fixture.depth) / 2;
      const halfZ = (Math.abs(Math.sin(radians)) * fixture.width + Math.abs(Math.cos(radians)) * fixture.depth) / 2;
      return {
        x: clampNumber(x, -booth.width / 2 + halfX, booth.width / 2 - halfX),
        z: clampNumber(z, -booth.depth / 2 + halfZ, booth.depth / 2 - halfZ),
      };
    },
    [booth.depth, booth.width],
  );

  const moveFixture = useCallback(
    (id: string, x: number, z: number) => {
      setFixtures((items) =>
        items.map((fixture) => {
          if (fixture.id !== id) return fixture;
          const next = clampFixtureToBooth(fixture, x, z);
          return { ...fixture, ...next };
        }),
      );
    },
    [clampFixtureToBooth],
  );

  function addFixture(fixture: Omit<Fixture, "id" | "x" | "z" | "rotation">) {
    const id = uid();
    const next: Fixture = { ...fixture, id, x: 0, z: 0, rotation: 0 };
    setFixtures((items) => [...items, next]);
    setSelectedId(id);
    setShowAiModal(false);
    setNotice({ kind: "success", message: `${fixture.name}을(를) 부스 중앙에 추가했습니다.` });
  }

  function addBasicFixture() {
    addFixture({ ...draft, source: "primitive" });
  }

  function duplicateSelected() {
    if (!selected) return;
    const id = uid();
    const clone = {
      ...selected,
      id,
      name: `${selected.name} 복사본`,
      x: selected.x + snap,
      z: selected.z + snap,
    };
    const position = clampFixtureToBooth(clone, clone.x, clone.z);
    setFixtures((items) => [...items, { ...clone, ...position }]);
    setSelectedId(id);
  }

  function removeSelected() {
    if (!selected) return;
    setFixtures((items) => items.filter((item) => item.id !== selected.id));
    setSelectedId(null);
    setNotice({ kind: "info", message: `${selected.name}을(를) 삭제했습니다.` });
  }

  function resetProject() {
    setBooth(DEFAULT_BOOTH);
    setBoothDraft({
      width: String(DEFAULT_BOOTH.width),
      depth: String(DEFAULT_BOOTH.depth),
      height: String(DEFAULT_BOOTH.height),
    });
    setFixtures([]);
    setSelectedId(null);
    setProjectName("2026 서울 펫페어 · A-14");
    setNotice({ kind: "info", message: "집기가 없는 새 부스로 초기화했습니다." });
  }

  function saveProject() {
    const data: ProjectData = {
      version: 1,
      name: projectName,
      booth,
      fixtures: fixtures.map((fixture) => ({
        ...fixture,
        modelUrl: fixture.modelUrl?.startsWith("blob:") ? undefined : fixture.modelUrl,
      })),
      savedAt: new Date().toISOString(),
    };
    downloadJson(data, `${projectName.replace(/[^a-zA-Z0-9가-힣-_]+/g, "-")}.pawplan.json`);
    setNotice({ kind: "success", message: "프로젝트 JSON을 저장했습니다." });
  }

  async function loadProject(file: File) {
    try {
      const data = JSON.parse(await file.text()) as ProjectData;
      if (data.version !== 1 || !data.booth || !Array.isArray(data.fixtures)) throw new Error();
      setProjectName(data.name || "불러온 프로젝트");
      const loadedBooth = { ...DEFAULT_BOOTH, ...data.booth };
      setBooth(loadedBooth);
      setBoothDraft({
        width: String(loadedBooth.width),
        depth: String(loadedBooth.depth),
        height: String(loadedBooth.height),
      });
      setFixtures(data.fixtures);
      setSelectedId(data.fixtures[0]?.id ?? null);
      setNotice({ kind: "success", message: "프로젝트를 불러왔습니다." });
    } catch {
      setNotice({ kind: "error", message: "올바른 PawPlan 프로젝트 파일이 아닙니다." });
    }
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).slice(0, 4);
    if (next.some((file) => file.size > 8 * 1024 * 1024)) {
      setNotice({ kind: "error", message: "사진 한 장의 크기는 8MB 이하여야 합니다." });
      return;
    }
    setImages(next.map((file) => ({ file, preview: URL.createObjectURL(file) })));
  }

  function updateBoothDraft(key: "width" | "depth" | "height", value: string) {
    if (/^\d*$/.test(value)) {
      setBoothDraft((current) => ({ ...current, [key]: value }));
    }
  }

  function applyBoothDimensions() {
    const width = Number(boothDraft.width);
    const depth = Number(boothDraft.depth);
    const height = Number(boothDraft.height);

    if (![width, depth, height].every((value) => Number.isFinite(value) && value > 0)) {
      setNotice({ kind: "error", message: "가로, 깊이, 높이를 0보다 큰 숫자로 모두 입력해 주세요." });
      return;
    }

    setBooth((current) => ({ ...current, width, depth, height }));
    setNotice({ kind: "success", message: `부스 크기를 ${width} × ${depth} × ${height} mm로 적용했습니다.` });
  }

  async function applySurfaceImage(target: "floor" | "wall", file: File) {
    if (!file.type.startsWith("image/")) {
      setNotice({ kind: "error", message: "PNG, JPG, WEBP 등 이미지 파일을 선택해 주세요." });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setNotice({ kind: "error", message: "마감 이미지는 8MB 이하로 선택해 주세요." });
      return;
    }

    const previousImage = target === "floor" ? booth.floorImage : booth.wallImage;
    const previewUrl = URL.createObjectURL(file);
    const surfaceWidth = booth.width;
    const surfaceHeight = target === "floor" ? booth.depth : booth.height;

    setBooth((current) =>
      target === "floor"
        ? { ...current, floorImage: previewUrl }
        : { ...current, wallImage: previewUrl },
    );

    try {
      const dataUrl = await fitSurfaceImage(file, surfaceWidth, surfaceHeight);
      setBooth((current) =>
        target === "floor"
          ? { ...current, floorImage: dataUrl }
          : { ...current, wallImage: dataUrl },
      );
      const sizeLabel = `${surfaceWidth} × ${surfaceHeight} mm`;
      setNotice({ kind: "success", message: `${target === "floor" ? "바닥" : "벽"} 이미지를 ${sizeLabel} 규격에 맞춰 적용했습니다.` });
    } catch {
      setBooth((current) =>
        target === "floor"
          ? { ...current, floorImage: previousImage }
          : { ...current, wallImage: previousImage },
      );
      setNotice({ kind: "error", message: "이미지를 읽지 못했습니다." });
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  }

  async function generateModel() {
    if (!images.length) {
      setNotice({ kind: "error", message: "집기의 사진을 한 장 이상 선택해 주세요." });
      return;
    }

    setGeneration({ status: "업로드 준비", progress: 2 });
    try {
      const dataUris = await Promise.all(images.map(({ file }) => fileToDataUrl(file)));
      setGeneration({ status: "AI 작업 요청 중", progress: 5 });
      const response = await fetch("/api/meshy/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: dataUris }),
      });
      const created = await response.json();
      if (!response.ok) throw new Error(created.error || "3D 생성 작업을 시작하지 못했습니다.");

      const taskId = created.taskId as string;
      setGeneration({ status: "AI가 입체 형상을 생성 중", progress: 8, taskId });
      const task = await pollTask(taskId);
      const modelUrl = task.model_urls?.glb;
      if (!modelUrl) throw new Error("생성 결과에 GLB 파일이 없습니다.");

      setGeneratedAsset({
        modelUrl,
        thumbnailUrl: task.thumbnail_url,
        source: "meshy",
        taskId,
      });
      setGeneration(null);
      setNotice({ kind: "success", message: "3D 생성이 완료되었습니다. 검수 후 부스에 추가해 주세요." });
    } catch (error) {
      setGeneration(null);
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "3D 생성에 실패했습니다." });
    }
  }

  async function pollTask(taskId: string): Promise<MeshyTask> {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await fetch(`/api/meshy/tasks/${encodeURIComponent(taskId)}`, { cache: "no-store" });
      const task = (await response.json()) as MeshyTask & { error?: string };
      if (!response.ok) throw new Error(task.error || "생성 상태를 확인하지 못했습니다.");

      setGeneration({
        status: task.status === "PENDING" ? "작업 대기 중" : "AI가 입체 형상을 생성 중",
        progress: task.progress ?? 0,
        taskId,
      });

      if (task.status === "SUCCEEDED") return task;
      if (["FAILED", "EXPIRED", "CANCELED"].includes(task.status)) {
        throw new Error(task.task_error?.message || `3D 생성이 ${task.status} 상태로 종료되었습니다.`);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
    }
    throw new Error("생성 대기 시간이 초과되었습니다. Meshy 대시보드에서 작업을 확인해 주세요.");
  }

  function handleGlbFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setNotice({ kind: "error", message: "GLB 형식의 3D 모델을 선택해 주세요." });
      return;
    }
    setGeneratedAsset({ modelUrl: URL.createObjectURL(file), source: "upload" });
    setNotice({ kind: "info", message: "GLB를 검수 화면에 불러왔습니다." });
  }

  function updateDraftCategory(category: FixtureCategory) {
    const preset = PRIMITIVE_PRESETS[category];
    setDraft((current) => ({
      ...current,
      category,
      name: preset.name,
      width: preset.width,
      depth: preset.depth,
      height: preset.height,
      color: CATEGORY_COLORS[category],
    }));
  }

  function confirmReviewedModel() {
    if (!generatedAsset) return;
    addFixture({
      ...draft,
      modelUrl: generatedAsset.modelUrl,
      thumbnailUrl: generatedAsset.thumbnailUrl,
      source: generatedAsset.source,
    });
    setGeneratedAsset(null);
    setImages([]);
  }

  function discardGeneratedAsset() {
    if (generatedAsset?.source === "upload" && generatedAsset.modelUrl.startsWith("blob:")) {
      URL.revokeObjectURL(generatedAsset.modelUrl);
    }
    setGeneratedAsset(null);
  }

  function closeAssetModal() {
    if (generation) return;
    discardGeneratedAsset();
    setImages([]);
    setShowAiModal(false);
  }

  function rotateDraftModel(axis: "x" | "y" | "z", amount: number) {
    setDraft((current) => ({
      ...current,
      modelRotation: {
        ...current.modelRotation,
        [axis]: (current.modelRotation[axis] + amount + 360) % 360,
      },
    }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><BoxSelect size={22} /></div>
          <div>
            <strong>PawPlan</strong>
            <span>EXHIBITION SPACE STUDIO</span>
          </div>
        </div>
        <div className="project-title">
          <span className="live-dot" />
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="프로젝트 이름" />
          <ChevronDown size={15} />
        </div>
        <div className="top-actions">
          <button className="button ghost" onClick={resetProject}>새 프로젝트</button>
          <input ref={projectInput} type="file" accept="application/json,.json" hidden onChange={(event) => event.target.files?.[0] && loadProject(event.target.files[0])} />
          <button className="button ghost" onClick={() => projectInput.current?.click()}><Upload size={16} /> 불러오기</button>
          <button className="button dark" onClick={saveProject}><Save size={16} /> 저장</button>
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
              <div className="section-heading">
                <div><span className="eyebrow">SPACE 01</span><h2>부스 실측 설정</h2></div>
                <span className="unit-badge">mm 기준</span>
              </div>
              <p className="help-text">치수를 모두 입력한 뒤 적용을 누르면 3D 공간이 한 번에 변경됩니다.</p>
              <div className="dimension-grid">
                <Field label="가로 W" unit="mm"><input type="text" inputMode="numeric" value={boothDraft.width} onChange={(e) => updateBoothDraft("width", e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyBoothDimensions()} /></Field>
                <Field label="깊이 D" unit="mm"><input type="text" inputMode="numeric" value={boothDraft.depth} onChange={(e) => updateBoothDraft("depth", e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyBoothDimensions()} /></Field>
                <Field label="높이 H" unit="mm"><input type="text" inputMode="numeric" value={boothDraft.height} onChange={(e) => updateBoothDraft("height", e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyBoothDimensions()} /></Field>
              </div>
              <button className={`button full apply-dimensions ${isBoothDirty ? "dirty" : ""}`} onClick={applyBoothDimensions}>
                <Check size={16} /> {isBoothDirty ? "입력한 부스 크기 적용" : "현재 부스 크기 적용됨"}
              </button>

              <div className="control-section">
                <label className="control-label">벽 구성</label>
                <div className="segmented three">
                  {(["three", "back", "none"] as const).map((mode) => (
                    <button key={mode} className={booth.wallMode === mode ? "active" : ""} onClick={() => setBooth({ ...booth, wallMode: mode })}>
                      {mode === "three" ? "3면" : mode === "back" ? "1면" : "없음"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-section">
                <div className="label-row"><label className="control-label">기본 바닥재</label><span className="surface-caption">공간기획 표준</span></div>
                <div className="floor-material-grid">
                  {FLOOR_MATERIALS.map((material) => (
                    <button
                      key={material.id}
                      className={booth.floorMaterial === material.id && !booth.floorImage ? "active" : ""}
                      onClick={() => setBooth({ ...booth, floorMaterial: material.id, floorColor: material.color, floorImage: undefined })}
                    >
                      <i className={material.className} style={{ "--floor-color": material.color } as React.CSSProperties} />
                      <span>{material.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-section surface-controls">
                <div className="color-row">
                  <Field label="바닥 직접 색상"><input className="color-input" type="color" value={booth.floorColor} onChange={(e) => setBooth({ ...booth, floorColor: e.target.value, floorMaterial: "custom", floorImage: undefined })} /></Field>
                  <Field label="벽 색상"><input className="color-input" type="color" value={booth.wallColor} onChange={(e) => setBooth({ ...booth, wallColor: e.target.value })} /></Field>
                </div>
                <div className="surface-upload-grid">
                  <div className={`surface-upload-card ${booth.floorImage ? "has-image" : ""}`}>
                    {booth.floorImage && <img src={booth.floorImage} alt="업로드한 바닥 이미지" />}
                    <div><strong>바닥 이미지</strong><small>평면 크기에 맞춰 적용</small></div>
                    <label className="button outline"><Upload size={14} /> {booth.floorImage ? "교체" : "업로드"}<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && applySurfaceImage("floor", e.target.files[0])} /></label>
                    {booth.floorImage && <button className="surface-remove" onClick={() => setBooth({ ...booth, floorImage: undefined })} aria-label="바닥 이미지 제거"><X size={13} /></button>}
                  </div>
                  <div className={`surface-upload-card ${booth.wallImage ? "has-image" : ""}`}>
                    {booth.wallImage && <img src={booth.wallImage} alt="업로드한 벽 이미지" />}
                    <div><strong>벽 이미지</strong><small>벽면 크기에 맞춰 적용</small></div>
                    <label className="button outline"><Upload size={14} /> {booth.wallImage ? "교체" : "업로드"}<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && applySurfaceImage("wall", e.target.files[0])} /></label>
                    {booth.wallImage && <button className="surface-remove" onClick={() => setBooth({ ...booth, wallImage: undefined })} aria-label="벽 이미지 제거"><X size={13} /></button>}
                  </div>
                </div>
              </div>

              <div className="control-section display-options">
                <div><label className="control-label">바닥 격자 표시</label><small>500mm 간격의 배치 가이드</small></div>
                <button className={`toggle ${booth.showGrid ? "on" : ""}`} role="switch" aria-checked={booth.showGrid} onClick={() => setBooth({ ...booth, showGrid: !booth.showGrid })}><i /></button>
              </div>

              <div className="control-section">
                <label className="control-label">이동 스냅</label>
                <div className="segmented three">
                  {[50, 100, 250].map((value) => <button key={value} className={snap === value ? "active" : ""} onClick={() => setSnap(value)}>{value} mm</button>)}
                </div>
              </div>

              <div className="summary-card">
                <div><span>부스 면적</span><strong>{(boothArea / 1_000_000).toFixed(1)} m²</strong></div>
                <div><span>집기 점유율</span><strong>{occupancy}%</strong></div>
                <div className="meter"><i style={{ width: `${occupancy}%` }} /></div>
                <small>동선 확보를 위해 55% 이하를 권장합니다.</small>
              </div>
            </div>
          ) : (
            <div className="panel-content">
              <div className="section-heading"><div><span className="eyebrow">FIXTURE 02</span><h2>기본 도형 추가</h2></div><span className="unit-badge">직접 설정</span></div>
              <p className="help-text primitive-help">기본 집기 유형을 고른 뒤 이름, 색상, 실측 크기를 입력해 빈 부스에 추가하세요.</p>
              <div className="primitive-grid">
                {(Object.keys(CATEGORY_LABELS) as FixtureCategory[]).map((category) => (
                  <button key={category} className={draft.category === category ? "active" : ""} onClick={() => updateDraftCategory(category)}>
                    <Box size={16} />
                    <span>{CATEGORY_LABELS[category]}</span>
                  </button>
                ))}
              </div>
              <div className="primitive-form">
                <Field label="집기 이름"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
                <div className="dimension-grid">
                  {(["width", "depth", "height"] as const).map((key) => (
                    <Field key={key} label={key === "width" ? "W" : key === "depth" ? "D" : "H"} unit="mm">
                      <input type="number" min="10" step="10" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: clampNumber(+e.target.value, 10, 20000) })} />
                    </Field>
                  ))}
                </div>
                <div className="primitive-color-action">
                  <Field label="색상"><input className="color-input" type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></Field>
                  <button className="button dark" onClick={addBasicFixture}><PackagePlus size={16} /> 부스에 추가</button>
                </div>
              </div>

              <div className="panel-divider"><span>또는</span></div>
              <button className="ai-card" onClick={() => setShowAiModal(true)}>
                <span className="ai-icon"><WandSparkles size={22} /></span>
                <span><strong>사진으로 3D 집기 만들기</strong><small>AI 변환 후 3D 검수 화면에서 확인하고 추가합니다.</small></span>
                <Sparkles size={17} />
              </button>
              <div className="library-heading"><span>배치된 집기</span><strong>{fixtures.length}</strong></div>
              <div className="fixture-list">
                {!fixtures.length && (
                  <div className="empty-fixture-list"><BoxSelect size={21} /><span>아직 배치된 집기가 없습니다.</span></div>
                )}
                {fixtures.map((fixture, index) => (
                  <button key={fixture.id} className={`fixture-row ${selectedId === fixture.id ? "selected" : ""}`} onClick={() => setSelectedId(fixture.id)}>
                    <span className="fixture-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="fixture-swatch" style={{ background: fixture.color }}><Box size={18} /></span>
                    <span className="fixture-copy"><strong>{fixture.name}</strong><small>{fixture.width} × {fixture.depth} × {fixture.height} mm</small></span>
                    {fixture.modelUrl && <span className="glb-badge">GLB</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="scene-area">
          <div className="scene-toolbar">
            <div className="view-switcher">
              {(["perspective", "top", "front"] as ViewPreset[]).map((preset) => (
                <button key={preset} className={view === preset ? "active" : ""} onClick={() => setView(preset)}>
                  {preset === "perspective" ? <><Camera size={15} /> 원근</> : preset === "top" ? <><Layers3 size={15} /> 평면</> : <><Box size={15} /> 정면</>}
                </button>
              ))}
            </div>
            <div className="scene-stats"><span>{(booth.width / 1000).toFixed(1)} × {(booth.depth / 1000).toFixed(1)} m</span><i /><span>스냅 {snap} mm</span></div>
          </div>
          <div className="canvas-wrap">
            <BoothScene booth={booth} fixtures={fixtures} selectedId={selectedId} view={view} snap={snap} onSelect={setSelectedId} onMove={moveFixture} />
            <div className="canvas-hint">
              <Move3d size={16} />
              <span><strong>집기를 드래그</strong>해 배치하고, 빈 공간을 드래그해 시점을 돌려보세요.</span>
              <span className="keyboard-hint"><kbd>X</kbd><span>/</span><kbd>Del</kbd> 선택 삭제</span>
            </div>
            <div className="axis-widget"><span className="axis-y">Y</span><span className="axis-x">X</span><span className="axis-z">Z</span><i /></div>
          </div>
        </section>

        <aside className="right-panel">
          {selected ? (
            <div className="inspector">
              <div className="section-heading inspector-heading"><div><span className="eyebrow">SELECTED OBJECT</span><h2>{selected.name}</h2></div><button className="icon-button" onClick={() => setSelectedId(null)} aria-label="선택 해제"><X size={18} /></button></div>
              <div className="object-preview" style={{ "--object-color": selected.color } as React.CSSProperties}>
                {selected.thumbnailUrl ? <img src={selected.thumbnailUrl} alt="AI 생성 집기 미리보기" /> : <Box size={54} strokeWidth={1.2} />}
                <span>{selected.source === "meshy" ? "AI GENERATED GLB" : selected.source === "upload" ? "UPLOADED GLB" : CATEGORY_LABELS[selected.category]}</span>
              </div>

              <div className="control-section">
                <Field label="이름"><input value={selected.name} onChange={(e) => updateFixture(selected.id, { name: e.target.value })} /></Field>
              </div>
              <div className="dimension-grid inspector-dimensions">
                {(["width", "depth", "height"] as const).map((key) => (
                  <Field key={key} label={key === "width" ? "W" : key === "depth" ? "D" : "H"} unit="mm">
                    <input type="number" min="10" step="10" value={selected[key]} onChange={(e) => updateFixture(selected.id, { [key]: clampNumber(+e.target.value, 10, 20000) })} />
                  </Field>
                ))}
              </div>
              <p className="microcopy">GLB 원본 비율과 관계없이 위 실측 크기에 정확히 맞춰집니다.</p>

              <div className="control-section">
                <label className="control-label">위치</label>
                <div className="position-grid">
                  <Field label="X" unit="mm"><input type="number" step={snap} value={Math.round(selected.x)} onChange={(e) => moveFixture(selected.id, +e.target.value, selected.z)} /></Field>
                  <Field label="Z" unit="mm"><input type="number" step={snap} value={Math.round(selected.z)} onChange={(e) => moveFixture(selected.id, selected.x, +e.target.value)} /></Field>
                </div>
              </div>

              <div className="control-section">
                <div className="label-row"><label className="control-label">회전</label><output>{selected.rotation}°</output></div>
                <input className="range" type="range" min="-180" max="180" step="5" value={selected.rotation} onChange={(e) => updateFixture(selected.id, { rotation: +e.target.value })} />
                <div className="rotation-buttons">{[-90, -45, 0, 45, 90].map((angle) => <button key={angle} className={selected.rotation === angle ? "active" : ""} onClick={() => updateFixture(selected.id, { rotation: angle })}>{angle}°</button>)}</div>
              </div>

              <div className="control-section color-row single-color"><Field label="오브젝트 색상"><input className="color-input" type="color" value={selected.color} onChange={(e) => updateFixture(selected.id, { color: e.target.value })} /></Field></div>
              <div className="inspector-actions">
                <button className="button outline" onClick={duplicateSelected}><Copy size={16} /> 복제</button>
                <button className="button danger" onClick={removeSelected} aria-keyshortcuts="Delete X"><Trash2 size={16} /> 삭제</button>
              </div>
              {selected.modelUrl && !selected.modelUrl.startsWith("blob:") && <a className="download-link" href={selected.modelUrl} download target="_blank" rel="noreferrer"><Download size={15} /> 원본 GLB 다운로드</a>}
            </div>
          ) : (
            <div className="empty-inspector">
              <span><BoxSelect size={32} /></span>
              <h2>{fixtures.length ? "집기를 선택하세요" : "빈 부스에서 시작합니다"}</h2>
              <p>{fixtures.length ? "3D 공간이나 집기 목록에서 오브젝트를 선택하면 실측 크기와 위치를 편집하고 삭제할 수 있습니다." : "왼쪽의 집기 탭에서 기본 도형의 색상과 실측값을 정하거나, 사진으로 새 3D 집기를 만들어 보세요."}</p>
              <div className="empty-actions">
                <button className="button outline" onClick={() => setActivePanel("fixture")}><Box size={16} /> 기본 도형 추가</button>
                <button className="button dark" onClick={() => setShowAiModal(true)}><Sparkles size={16} /> AI 집기 만들기</button>
              </div>
            </div>
          )}
        </aside>
      </section>

      <footer className="statusbar">
        <span><i className="status-ok"><Check size={10} /></i> 편집 가능</span>
        <span>오브젝트 {fixtures.length}</span>
        <span>점유 면적 {(occupiedArea / 1_000_000).toFixed(2)} m²</span>
        <span className="status-tip">실측 기준 · 1 unit = 1 mm</span>
      </footer>

      {notice && <div className={`toast ${notice.kind}`}>{notice.kind === "success" ? <Check size={17} /> : notice.kind === "error" ? <X size={17} /> : <Sparkles size={17} />}{notice.message}</div>}

      {showAiModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeAssetModal()}>
          <section className={`modal ${generatedAsset ? "review-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="fixture-modal-title">
            <div className="modal-header">
              <div>
                <span className="eyebrow">{generatedAsset ? "REVIEW 3D RESULT" : "NEW 3D FIXTURE"}</span>
                <h2 id="fixture-modal-title">{generatedAsset ? "3D 결과를 확인해 주세요" : "집기를 3D 자산으로 만들기"}</h2>
                <p>{generatedAsset ? "모든 방향에서 형상과 텍스처를 확인하고 실측 크기와 방향을 보정한 뒤 추가하세요." : "직접 GLB를 올리거나, 같은 집기의 여러 각도 사진을 AI로 변환하세요."}</p>
              </div>
              <button className="icon-button" disabled={!!generation} onClick={closeAssetModal} aria-label="닫기"><X size={20} /></button>
            </div>
            {generatedAsset ? (
              <div className="review-body">
                <div className="review-stage">
                  <ModelReview
                    modelUrl={generatedAsset.modelUrl}
                    width={draft.width}
                    depth={draft.depth}
                    height={draft.height}
                    rotation={draft.modelRotation}
                  />
                  <div className="review-checklist">
                    <span><Check size={13} /> 앞·뒤·옆 형상이 자연스러운지</span>
                    <span><Check size={13} /> 불필요한 조각이나 구멍이 없는지</span>
                    <span><Check size={13} /> 텍스처와 바닥 방향이 맞는지</span>
                  </div>
                </div>
                <div className="review-panel">
                  <div className="review-status"><span><Check size={15} /></span><div><strong>3D 생성 완료</strong><small>아직 부스에는 추가되지 않았습니다.</small></div></div>
                  <Field label="집기 이름"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
                  <Field label="분류"><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as FixtureCategory })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                  <div>
                    <label className="control-label">최종 실측 크기</label>
                    <div className="dimension-grid">
                      {(["width", "depth", "height"] as const).map((key) => <Field key={key} label={key === "width" ? "W" : key === "depth" ? "D" : "H"} unit="mm"><input type="number" min="10" step="10" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: clampNumber(+e.target.value, 10, 20000) })} /></Field>)}
                    </div>
                  </div>
                  <div className="orientation-control">
                    <div className="label-row"><label className="control-label">모델 방향 보정</label><button onClick={() => setDraft({ ...draft, modelRotation: { x: 0, y: 0, z: 0 } })}>초기화</button></div>
                    <div className="orientation-buttons">
                      {(["x", "y", "z"] as const).map((axis) => (
                        <div key={axis}><span>{axis.toUpperCase()}축 {draft.modelRotation[axis]}°</span><button onClick={() => rotateDraftModel(axis, -90)}>-90°</button><button onClick={() => rotateDraftModel(axis, 90)}>+90°</button></div>
                      ))}
                    </div>
                  </div>
                  <p className="dimension-note"><Maximize2 size={15} /> 보정값은 검수 화면과 실제 부스 모델에 동일하게 적용됩니다.</p>
                  <div className="review-actions">
                    <button className="button outline" onClick={discardGeneratedAsset}><RotateCw size={16} /> 다시 선택</button>
                    <button className="button dark" onClick={confirmReviewedModel}><Check size={17} /> 확인 후 부스에 추가</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="modal-body">
                <div className="asset-form">
                  <Field label="집기 이름"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
                  <Field label="분류"><select value={draft.category} onChange={(e) => updateDraftCategory(e.target.value as FixtureCategory)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                  <div className="dimension-grid">
                    {(["width", "depth", "height"] as const).map((key) => <Field key={key} label={key === "width" ? "가로 W" : key === "depth" ? "깊이 D" : "높이 H"} unit="mm"><input type="number" min="10" step="10" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: clampNumber(+e.target.value, 10, 20000) })} /></Field>)}
                  </div>
                  <Field label="대체 표시 색상"><input className="color-input" type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></Field>
                  <p className="dimension-note"><Maximize2 size={15} /> 생성 후 별도 검수 화면에서 크기와 모델 방향을 다시 수정할 수 있습니다.</p>
                  <div className="source-actions one-column">
                    <input ref={glbInput} type="file" accept=".glb,model/gltf-binary" hidden onChange={(event) => event.target.files?.[0] && handleGlbFile(event.target.files[0])} />
                    <button className="button outline" onClick={() => glbInput.current?.click()}><FileBox size={17} /> 가지고 있는 GLB 검수하기</button>
                  </div>
                </div>

                <div className="ai-upload-zone">
                  <div className="upload-title"><span className="ai-icon"><ImagePlus size={21} /></span><span><strong>AI Image-to-3D</strong><small>정면 · 측면 · 후면처럼 서로 다른 각도를 권장합니다.</small></span><em>1–4장</em></div>
                  <label className="dropzone">
                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden disabled={!!generation} onChange={(event) => handleImageFiles(event.target.files)} />
                    {images.length ? (
                      <div className="image-previews">{images.map(({ file, preview }, index) => <figure key={`${file.name}-${index}`}><img src={preview} alt={`${index + 1}번째 집기 사진`} /><figcaption>{index === 0 ? "정면" : `${index + 1}번 뷰`}</figcaption></figure>)}</div>
                    ) : (
                      <div className="dropzone-empty"><Upload size={25} /><strong>사진을 선택하거나 끌어 놓으세요</strong><span>PNG, JPG, WEBP · 사진당 최대 8MB</span></div>
                    )}
                  </label>
                  {generation ? (
                    <div className="generation-progress">
                      <div className="progress-copy"><span><LoaderCircle className="spin" size={17} /> {generation.status}</span><strong>{Math.round(generation.progress)}%</strong></div>
                      <div className="progress-track"><i style={{ width: `${Math.max(3, generation.progress)}%` }} /></div>
                      <small>페이지를 닫지 마세요. 고품질 GLB 생성에는 몇 분이 걸릴 수 있습니다.</small>
                    </div>
                  ) : (
                    <button className="button ai-button" onClick={generateModel} disabled={!images.length}><WandSparkles size={18} /> AI로 3D 생성 후 검수</button>
                  )}
                  <p className="api-note"><Check size={13} /> API 키는 브라우저로 전송되지 않고 서버 라우트에서만 사용됩니다.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
