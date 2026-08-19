# Hustle 3D Studio

현실에 있거나 머릿속으로 구상한 물체를 Part 단위로 만들고, 변형하고, 조립하고, 디자인한 뒤 실제 크기의 공간에 배치하는 **범용 DIY 3D Visual Planning Studio**입니다. 특정 제품 카테고리를 전제로 하지 않으며 모든 결과를 generic `AssetDefinition`과 `AssetInstance`로 다룹니다.

## 현재 가능한 흐름

1. **3D 오브젝트 만들기**에서 실제 mm 치수의 Part를 생성합니다.
2. Primitive, Sketch → Extrude, Path → Sweep, Profile → Revolve 중 생성 원리를 선택합니다.
3. 뷰포트 control point와 Bend gizmo로 형상을 직접 조작하고 Inspector에서 수치를 정밀 조정합니다.
4. 중첩 Group, 이동, 회전, 정렬, 복제, hide, transform/edit lock, isolate로 Assembly를 구성합니다.
5. 전체 또는 material region별 색상·이미지·roughness·metalness·opacity를 적용합니다.
6. Asset을 `내 오브젝트`에 저장하고 동일한 AssetDefinition으로 여러 AssetInstance를 공간에 배치합니다.
7. `.hustle3d` 프로젝트로 내보내면 source parameter, hierarchy, 이미지, GLB, 공간 설정이 함께 저장됩니다.

## Modeling tools

- Primitive: Box, Cylinder, Sphere, Cone, Rod, Bar
- Sketch: Rectangle, Circle, Point/Line polygon, Bezier closed curve
- Extrude: Sketch source와 depth를 보존하는 실제 `ExtrudeGeometry`
- Path / Sweep: linear 또는 Catmull-Rom path + 원형/사각형/얇은 사각형 단면
- Revolve: 2D profile, angle, segments를 보존하는 실제 `LatheGeometry`
- Bend: axis, angle, radius, range를 보존하는 비파괴 modifier
- GLB import: 고급 기능. orientation group과 measurement scale group을 분리해 입력 W/D/H에 맞춤

## 명확한 interaction mode

- **보기**: Orbit / Pan / Zoom만 동작
- **배치**: Part/Group transform gizmo 또는 Space의 AssetInstance drag/rotation만 동작
- **형상 편집**: Sketch, Bezier, Sweep path, Revolve profile, Bend handle만 동작

Geometry handle을 움직이는 동안 camera와 object placement는 비활성화됩니다. Lock 상태는 interaction mode보다 우선합니다.

## 단위와 좌표

- 사용자 입력과 project source data: **millimeter**
- 각도: **degree**
- Three.js 내부: **1 unit = 1 meter**

mm → meter 변환은 Geometry 생성/렌더 경계에서 수행합니다. GLB의 orientation과 world-space size scaling은 분리된 transform group에서 처리됩니다.

## Architecture

```text
studio/
├── domain/       Asset, Node, Group, lock, pivot, hierarchy, project schema
├── geometry/     UI와 분리된 geometry operation과 bounding 계산
├── commands/     immutable undo / redo history
├── persistence/  local Asset Library와 Worker 기반 portable archive
└── space/        AssetInstance boundary / placement

components/studio/
├── AssetBuilder             Universal Object Builder
├── AssetRenderer            AssetDefinition 공통 renderer
├── DirectManipulationGizmos Curve / Bend / Transform handle
├── SpaceStudio              실측 공간 편집기
└── StudioApp                Asset Library와 project workflow
```

각 `AssetPartNode`는 최종 mesh만 저장하지 않고 `GeometrySource`, modifier, material region을 보존합니다. 새 operation은 `GeometrySource` union과 `buildGeometry` dispatcher에 추가하고 전용 Inspector/gizmo를 연결할 수 있습니다. 공간에는 내부 Part가 아닌 `AssetInstance`만 배치됩니다.

## Portable project

`.hustle3d`는 ZIP 기반이며 다음 구조를 사용합니다.

```text
project.json
assets/
  objects/...
  space/...
```

이미지와 GLB data URL은 Web Worker에서 asset file로 분리되고 import 시 복원됩니다. 큰 archive의 zip/unzip은 UI thread에서 실행하지 않습니다.

## 실행

```bash
pnpm install
pnpm dev
```

기본 개발 주소는 [http://localhost:3000](http://localhost:3000)입니다. 별도 Python, GPU, 서버, API key 또는 외부 AI 서비스가 필요하지 않습니다.

## 검증

```bash
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:e2e
```

단위 테스트는 geometry 생성, Bend 변형, GLB 실측 scaling, placement boundary, texture aspect, 임의 깊이 hierarchy, lock 상속, world-space 보존 reparent/ungroup을 검사합니다. E2E 테스트는 브라우저에서 생성 → 형상 편집 → 재질 → Group → 저장 → Space 배치 흐름을 검사합니다.

## GitHub Pages

정적 export는 `GITHUB_PAGES=true pnpm build`로 생성할 수 있으며 base path는 `/3d-rendering`입니다. 공개 preview는 [Hustle 3D Studio](https://hyperstar467.github.io/3d-rendering/)에서 확인합니다.

## 범위

Foundation은 Primitive, Sketch/Extrude, Path/Sweep, Revolve, Bend, hierarchy/assembly, material/image, Asset Library, Space placement를 우선합니다. Boolean, Loft, cloth simulation, sculpting, vertex editor, 제조 CAD constraint와 AI 3D 생성은 현재 범위가 아닙니다.
