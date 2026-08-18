# PawPlan — 펫페어 3D 공간 플래너

부스 실측값과 집기 실측값을 기준으로 펫페어 전시 공간을 브라우저에서 설계하는 Next.js 애플리케이션입니다. 사진 1~4장을 Meshy Multi-Image-to-3D API로 변환하고, 반환된 GLB를 사용자가 입력한 W/D/H에 맞게 보정해 부스 안에 배치합니다.

## 구현된 기능

- 부스 가로·깊이·높이(mm)를 자유롭게 입력하고 적용 버튼으로 일괄 반영
- 0/1/3면 벽, 벽·바닥 색상과 면 규격에 즉시 맞춰지는 사용자 이미지 마감
- 진회색·연회색 카펫, 콘크리트, 회색·백색 타일, 우드 기본 바닥재
- Three.js 기반 원근/탑/정면 뷰와 켜고 끌 수 있는 실측 그리드
- 집기 없는 빈 부스에서 시작
- 집기 선택, 바닥 드래그, 스냅, 위치·회전·크기 편집, 복제 및 `X`/`Delete` 단축키 삭제
- 진열대·선반·테이블·카운터·배너·쇼케이스·포디움·의자·스툴·소파·행거/랙·파티션의 색상과 실측값 지정 후 추가
- GLB 직접 업로드 및 브라우저 미리보기
- 동일 집기 사진 1~4장 → Meshy AI → GLB 생성 및 진행률 표시
- 생성된 GLB를 부스에 넣기 전 360° 검수하고 이름·분류·실측 크기·X/Y/Z 방향 보정
- GLB 바운딩 박스를 분석해 입력한 W/D/H(mm)에 X/Y/Z축 스케일 보정
- 프로젝트 JSON 저장·불러오기
- Meshy API 키를 서버 라우트에서만 사용

## 로컬 실행

Node.js 20.9 이상과 pnpm이 필요합니다.

```bash
pnpm install
cp .env.example .env.local
# .env.local에 MESHY_API_KEY 입력
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다. Meshy 키가 없어도 기본 도형과 직접 GLB 업로드를 포함한 편집기 기능은 사용할 수 있습니다.

## 환경 변수

```env
MESHY_API_KEY=your_secret_key
```

`MESHY_API_KEY`에 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. `/api/meshy/tasks`와 `/api/meshy/tasks/[taskId]` 서버 라우트만 이 값을 읽습니다.

## API 흐름

1. 브라우저가 사진을 데이터 URI로 변환해 `POST /api/meshy/tasks`로 전송합니다.
2. 서버가 Meshy `POST /openapi/v1/multi-image-to-3d`를 호출합니다.
3. 브라우저가 `GET /api/meshy/tasks/:taskId`를 폴링합니다.
4. 완료된 GLB URL을 React Three Fiber가 불러오고 실측 W/D/H로 보정합니다.

## 배포 메모

Vercel에 배포할 때 프로젝트 환경 변수에 `MESHY_API_KEY`를 추가하면 됩니다. Meshy가 반환하는 자산 URL은 만료될 수 있으므로, 장기 프로젝트 저장이 필요한 운영 버전에서는 생성 완료 직후 GLB를 S3/R2/Supabase Storage 같은 영구 오브젝트 스토리지로 복사하는 서버 작업을 추가해야 합니다. 현재 MVP의 JSON 저장은 원격 GLB URL을 보존하지만, 브라우저에서 직접 올린 `blob:` URL은 세션 전용이라 저장 파일에서 제외됩니다.

## 검증

```bash
pnpm typecheck
pnpm build
```
