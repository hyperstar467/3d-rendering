# PawPlan — 펫페어 3D 공간 플래너

실측 부스와 집기를 브라우저에서 설계하는 로컬 우선 3D 공간 플래너입니다. 외부 AI API나 API 키 없이 기본 도형, 면별 사진 Box, 직접 업로드한 GLB를 모두 사용할 수 있습니다.

## 주요 기능

- 부스 W/D/H를 mm 단위로 입력한 뒤 `적용` 버튼으로 일괄 반영
- 빈 부스에서 시작하고 기본 공간 기획 집기를 실측값과 색상으로 추가
- 사진 집기: 정면·좌측·우측·후면 사진을 정확한 W/D/H Box 각 면에 적용
- 면별 `contain`/`cover`, zoom, X/Y position, rotation 조절과 별도 3D preview
- GLB 직접 업로드, X/Y/Z 방향 보정, 공통 실측 scaling utility와 최종 BoundingBox 검수
- 선택 집기 드래그·스냅·회전·크기 변경·복제와 `X`/`Delete` 삭제
- 회전된 footprint 기준 부스 경계 보정과 부스보다 큰 집기 오류 표시
- 부스 영역에만 표시되는 500mm custom grid
- 바닥과 후면·좌측·우측 벽을 각각 색상 또는 사용자 이미지로 마감
- 진회색·연회색 카펫, 콘크리트, 회색·백색 타일, 우드 기본 바닥재
- 업로드 자산을 모두 포함하는 ZIP 기반 `.pawplan` 프로젝트 저장·불러오기

## 로컬 실행

Node.js 20.9 이상과 pnpm이 필요합니다. 환경 변수나 외부 서비스 계정은 필요하지 않습니다.

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 프로젝트 파일

`.pawplan`은 다음 구조의 ZIP 파일입니다.

```text
project.json
assets/
  booth/
  fixtures/
```

`project.json`에는 부스·집기 설정과 asset 경로가 들어가고, 사용자가 올린 GLB·집기 사진·벽 이미지·바닥 이미지는 `assets/`에 함께 저장됩니다. 따라서 별도 서버나 원격 URL 없이 파일 하나로 다른 브라우저에서 프로젝트를 복원할 수 있습니다. 이전 JSON 프로젝트도 불러올 수 있습니다.

## 실측과 좌표 단위

- 모든 UI 입력과 프로젝트 데이터: `mm`
- Three.js 내부 좌표: `1 unit = 1 meter`
- 렌더링 경계에서 mm를 meter로 변환
- GLB는 `Orientation group`과 `Scale group`을 분리하고, 방향 보정 후의 world-space BoundingBox를 기준으로 목표 W/D/H를 맞춤

사진 집기는 입력 W/D/H로 Box geometry를 직접 만들기 때문에 외곽 실측이 그대로 유지됩니다. GLB는 `lib/modelTransform.ts`의 공통 함수를 preview와 실제 부스가 함께 사용합니다.

## 검증

```bash
pnpm typecheck
pnpm build
```

브라우저 검증 시 권장 기준 시나리오는 6000 × 4000 × 2500mm 부스와 1200 × 450 × 1800mm 집기입니다.
