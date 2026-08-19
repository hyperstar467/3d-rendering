"use client";

import {
  Archive,
  Boxes,
  BoxSelect,
  ChevronRight,
  Copy,
  Download,
  LayoutGrid,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AssetBuilder } from "@/components/studio/AssetBuilder";
import { SpaceStudio } from "@/components/studio/SpaceStudio";
import { createEmptyAsset, createId, createProject } from "@/studio/domain/defaults";
import type { AssetDefinition, HustleProject } from "@/studio/domain/types";
import { localAssetLibrary } from "@/studio/persistence/library";
import { downloadHustleProject, readHustleProject } from "@/studio/persistence/projectArchive";
import { getAssetBounds } from "@/studio/geometry/bounds";
import { clampInstance } from "@/studio/space/placement";
import { t } from "@/studio/i18n/ko";

type View = "home" | "builder" | "library" | "space";

function uniqueAssets(projectAssets: AssetDefinition[], libraryAssets: AssetDefinition[]) {
  const byId = new Map<string, AssetDefinition>();
  [...libraryAssets, ...projectAssets].forEach((asset) => byId.set(asset.id, asset));
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function AppHeader({
  view,
  onNavigate,
  onDownload,
  onOpen,
  busy,
}: {
  view: View;
  onNavigate: (view: View) => void;
  onDownload: () => void;
  onOpen: () => void;
  busy: boolean;
}) {
  return (
    <header className="app-header">
      <button className="brand" onClick={() => onNavigate("home")}>
        <span className="brand-mark"><Boxes /></span>
        <span><strong>Hustle 3D</strong><small>STUDIO</small></span>
      </button>
      <nav>
        <button className={view === "builder" ? "active" : ""} onClick={() => onNavigate("builder")}>오브젝트 Builder</button>
        <button className={view === "library" ? "active" : ""} onClick={() => onNavigate("library")}>{t("library")}</button>
        <button className={view === "space" ? "active" : ""} onClick={() => onNavigate("space")}>{t("space")}</button>
      </nav>
      <div className="header-actions">
        <button onClick={onOpen} disabled={busy}><Upload size={15} /> {t("openProject")}</button>
        <button onClick={onDownload} disabled={busy}><Download size={15} /> {busy ? "처리 중…" : t("saveProject")}</button>
      </div>
    </header>
  );
}

export function StudioApp() {
  const [project, setProject] = useState<HustleProject>(() => createProject());
  const [library, setLibrary] = useState<AssetDefinition[]>([]);
  const [view, setView] = useState<View>("home");
  const [editingAssetId, setEditingAssetId] = useState<string>();
  const [builderReturnView, setBuilderReturnView] = useState<"library" | "space">("library");
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const projectInput = useRef<HTMLInputElement>(null);
  const assets = uniqueAssets(project.assets, library);

  useEffect(() => setLibrary(localAssetLibrary.list()), []);

  const startNewAsset = () => {
    const asset = createEmptyAsset(`오브젝트 ${assets.length + 1}`);
    setProject((current) => ({ ...current, assets: [...current.assets, asset] }));
    setEditingAssetId(asset.id);
    setBuilderReturnView("library");
    setView("builder");
  };

  const editAsset = (assetId: string, returnView: "library" | "space" = "library") => {
    const libraryAsset = assets.find((asset) => asset.id === assetId);
    if (!libraryAsset) return;
    setProject((current) => current.assets.some((asset) => asset.id === assetId) ? current : { ...current, assets: [...current.assets, structuredClone(libraryAsset)] });
    setEditingAssetId(assetId);
    setBuilderReturnView(returnView);
    setView("builder");
  };

  const saveAsset = (asset: AssetDefinition) => {
    setProject((current) => ({ ...current, assets: [...current.assets.filter((candidate) => candidate.id !== asset.id), asset], savedAt: new Date().toISOString() }));
    try {
      localAssetLibrary.save(asset);
      setLibrary(localAssetLibrary.list());
      setNotice(`‘${asset.name}’을 내 오브젝트에 저장했습니다.`);
    } catch {
      setNotice("브라우저 저장 용량을 초과했습니다. 프로젝트 파일로 저장해 보관하세요.");
    }
  };

  const addToSpace = (asset: AssetDefinition) => {
    saveAsset(asset);
    const placement = clampInstance(getAssetBounds(asset), project.space, 0, 0, 0);
    if (!placement.fits) {
      setNotice(placement.message);
      return;
    }
    setProject((current) => {
      const nextAsset = structuredClone(asset);
      const instance = { id: createId("instance"), assetId: asset.id, name: asset.name, position: { x: placement.x, z: placement.z }, rotation: 0 };
      return {
        ...current,
        assets: [...current.assets.filter((candidate) => candidate.id !== asset.id), nextAsset],
        space: { ...current.space, instances: [...current.space.instances, instance] },
      };
    });
    setView("space");
  };

  const removeAsset = (assetId: string) => {
    localAssetLibrary.remove(assetId);
    setLibrary(localAssetLibrary.list());
    setProject((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== assetId),
      space: { ...current.space, instances: current.space.instances.filter((instance) => instance.assetId !== assetId) },
    }));
  };

  const duplicateAsset = (asset: AssetDefinition) => {
    const now = new Date().toISOString();
    const copy = { ...structuredClone(asset), id: createId("asset"), name: `${asset.name} 복사본`, createdAt: now, updatedAt: now };
    const idMap = new Map(copy.nodes.map((node) => [node.id, createId(node.type)]));
    copy.nodes = copy.nodes.map((node) => ({ ...node, id: idMap.get(node.id)!, parentId: node.parentId ? idMap.get(node.parentId) ?? null : null }));
    saveAsset(copy);
  };

  const downloadProject = async () => {
    setBusy(true);
    setNotice("이미지와 GLB를 프로젝트에 묶는 중입니다…");
    try {
      await downloadHustleProject(project);
      setNotice("모든 source parameter와 asset을 포함한 .hustle3d 파일을 저장했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "프로젝트 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const openProject = async (file: File) => {
    setBusy(true);
    setNotice("프로젝트를 복원하는 중입니다…");
    try {
      const next = await readHustleProject(file);
      setProject(next);
      next.assets.forEach((asset) => {
        try { localAssetLibrary.save(asset); } catch { /* portable project remains the source of truth */ }
      });
      setLibrary(localAssetLibrary.list());
      setEditingAssetId(undefined);
      setView("home");
      setNotice(`${next.name}을 열었습니다. Geometry·Hierarchy·Material·Space가 복원되었습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "프로젝트를 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const navigate = (next: View) => {
    if (next === "builder") {
      if (editingAssetId && assets.some((asset) => asset.id === editingAssetId)) setView("builder");
      else startNewAsset();
      return;
    }
    setView(next);
  };

  const editingAsset = assets.find((asset) => asset.id === editingAssetId);
  if (view === "builder" && editingAsset) return <AssetBuilder initialAsset={editingAsset} onBack={() => setView(builderReturnView)} onSave={saveAsset} onAddToSpace={addToSpace} />;
  if (view === "space") return <SpaceStudio space={project.space} assets={assets} onChange={(space) => setProject((current) => ({ ...current, space }))} onBack={() => setView("home")} onEditAsset={(assetId) => editAsset(assetId, "space")} />;

  return (
    <main className="app-shell">
      <AppHeader view={view} onNavigate={navigate} onDownload={downloadProject} onOpen={() => projectInput.current?.click()} busy={busy} />
      <input ref={projectInput} className="visually-hidden" type="file" accept=".hustle3d,application/zip" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void openProject(file); event.currentTarget.value = ""; }} />
      {notice && <button className="app-notice" onClick={() => setNotice(undefined)}>{notice}</button>}

      {view === "home" ? (
        <div className="home-page">
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-kicker"><Sparkles size={14} /> MAKE · ASSEMBLE · VISUALIZE</span>
              <h1>떠올린 물체를<br /><em>직접 3D로.</em></h1>
              <p>단순한 생성 원리로 Part를 만들고, 실제 mm 치수로 조립하고, 색상과 이미지를 디자인한 뒤 현실 크기의 공간에서 확인하세요.</p>
              <div className="hero-actions"><button className="primary-button large" onClick={startNewAsset}><Plus /> {t("builder")}</button><button className="secondary-button large" onClick={() => setView("space")}><LayoutGrid /> {t("space")} 열기</button></div>
            </div>
            <div className="hero-visual" aria-label="Hustle 3D Studio 모델링 원리">
              <div className="shape-card shape-a"><span>01</span><strong>Shape</strong><small>Point · Line · Bezier</small></div>
              <div className="shape-card shape-b"><span>02</span><strong>Geometry</strong><small>Extrude · Sweep · Revolve</small></div>
              <div className="shape-card shape-c"><span>03</span><strong>Assembly</strong><small>Transform · Group · Bend</small></div>
              <div className="orbital-ring" />
              <div className="hero-cube"><i /><i /><i /></div>
            </div>
          </section>
          <section className="workflow-strip"><span>Part 생성</span><ChevronRight /><span>실측 편집</span><ChevronRight /><span>조립</span><ChevronRight /><span>외관 디자인</span><ChevronRight /><span>공간 배치</span></section>
          <section className="home-grid">
            <button className="feature-card" onClick={startNewAsset}><span className="feature-icon orange"><BoxSelect /></span><span><strong>Universal Object Builder</strong><small>Primitive부터 자유 Shape, Path, Profile까지</small></span><ChevronRight /></button>
            <button className="feature-card" onClick={() => setView("library")}><span className="feature-icon violet"><Archive /></span><span><strong>내 오브젝트</strong><small>{assets.length ? `${assets.length}개 저장됨` : "재사용 가능한 Asset Library"}</small></span><ChevronRight /></button>
            <button className="feature-card" onClick={() => setView("space")}><span className="feature-icon blue"><LayoutGrid /></span><span><strong>실측 공간 배치</strong><small>{project.space.width} × {project.space.depth} × {project.space.height} mm</small></span><ChevronRight /></button>
          </section>
        </div>
      ) : (
        <div className="library-page">
          <div className="page-heading"><div><span className="eyebrow">REUSABLE ASSET DEFINITIONS</span><h1>내 오브젝트</h1><p>Part와 생성 파라미터를 유지한 채 다시 열고, 편집하고, 다른 공간에 재사용할 수 있습니다.</p></div><button className="primary-button" onClick={startNewAsset}><Plus /> 새 오브젝트</button></div>
          {assets.length ? <div className="library-grid">{assets.map((asset) => <article className="library-card" key={asset.id}><button className="asset-thumbnail" onClick={() => editAsset(asset.id)}><span>{asset.nodes.filter((node) => node.type === "part").length}</span><small>PARTS</small></button><div className="asset-card-copy"><h2>{asset.name}</h2><p>{asset.description || "설명 없음"}</p><small>{new Date(asset.updatedAt).toLocaleString("ko-KR")}</small></div><div className="asset-card-actions"><button onClick={() => editAsset(asset.id)}>편집</button><button onClick={() => { setProject((current) => ({ ...current, assets: [...current.assets.filter((candidate) => candidate.id !== asset.id), asset] })); setView("space"); }}>공간에서 열기</button><button aria-label="복제" onClick={() => duplicateAsset(asset)}><Copy size={15} /></button><button aria-label="삭제" className="danger" onClick={() => removeAsset(asset.id)}><Trash2 size={15} /></button></div></article>)}</div> : <div className="empty-library"><Boxes /><h2>아직 저장한 오브젝트가 없습니다.</h2><p>서로 다른 Geometry operation을 조합해 첫 Asset을 만들어 보세요.</p><button className="primary-button" onClick={startNewAsset}><Plus /> 시작하기</button></div>}
        </div>
      )}
    </main>
  );
}
