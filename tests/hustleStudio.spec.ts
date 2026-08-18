import { expect, test, type Locator, type Page } from "@playwright/test";

const fixture = "tests/fixtures/surface-4x3.svg";
const contrastFixture = "tests/fixtures/surface-contrast.svg";

function trackCriticalErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

async function openBuilder(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /떠올린 물체를/ })).toBeVisible();
  await page.getByRole("button", { name: "3D 오브젝트 만들기" }).click();
  await expect(page.getByTestId("asset-builder")).toBeVisible();
}

async function addNamedPart(page: Page, tool: string, name: string) {
  await page.getByRole("button", { name: tool, exact: true }).click();
  await page.locator(".tree-name-input").fill(name);
}

async function dragHandle(page: Page, name: string, dx: number, dy: number) {
  const handle = page.getByRole("button", { name: new RegExp(`^조절: ${name}`) });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + dx / 2, box!.y + box!.height / 2 + dy / 2, { steps: 3 });
  await page.mouse.move(box!.x + box!.width / 2 + dx, box!.y + box!.height / 2 + dy, { steps: 3 });
  await page.mouse.up();
}

async function waitForCanvasChange(canvas: Locator, before: Buffer, label: string) {
  let latest = before;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await canvas.page().waitForTimeout(100);
    latest = await canvas.screenshot();
    if (!latest.equals(before)) return latest;
  }
  expect(latest.equals(before), `${label}: 실제 WebGL canvas pixel이 바뀌어야 합니다.`).toBe(false);
  return latest;
}

async function uploadSurface(card: Locator, file = contrastFixture) {
  if (!(await card.getAttribute("open"))) await card.locator("summary").click();
  await card.locator('input[type="file"]').setInputFiles(file);
  await expect(card.getByRole("button", { name: "이미지 제거" })).toBeVisible();
}

test("all core geometry tools create real editable meshes and direct handles", async ({ page }) => {
  const errors = trackCriticalErrors(page);
  await openBuilder(page);

  await page.locator('input[accept*=".glb"]').setInputFiles("tests/fixtures/measured.glb");
  await expect(page.getByRole("button", { name: "원본 재질" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "W mm" }).fill("1200");
  await page.getByRole("spinbutton", { name: "W mm" }).press("Enter");
  await page.getByRole("spinbutton", { name: "D mm" }).fill("450");
  await page.getByRole("spinbutton", { name: "D mm" }).press("Enter");
  await page.getByRole("spinbutton", { name: "H mm" }).fill("1800");
  await page.getByRole("spinbutton", { name: "H mm" }).press("Enter");
  await page.getByRole("spinbutton", { name: "방향 Y °" }).fill("90");
  await page.getByRole("spinbutton", { name: "방향 Y °" }).press("Enter");
  await expect(page.getByText("W 1200 mm")).toBeVisible();
  await expect(page.getByText("D 450 mm")).toBeVisible();
  await expect(page.getByText("H 1800 mm")).toBeVisible();
  await page.getByRole("button", { name: "단색 Override" }).click();
  await page.getByLabel("색상").fill("#6633aa");
  await expect(page.getByLabel("색상")).toHaveValue("#6633aa");

  await page.getByRole("button", { name: "Box", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "W mm" })).toHaveValue("800");

  await page.getByRole("button", { name: /Sketch → Extrude/ }).click();
  const polygon = page.getByLabel("Point / Line 외곽선");
  const beforePoint = await polygon.inputValue();
  await dragHandle(page, "P3", 70, -18);
  await expect(polygon).not.toHaveValue(beforePoint);

  await page.getByRole("button", { name: "+ 휘기" }).click();
  const angle = page.getByRole("spinbutton", { name: "각도 °" });
  await expect(angle).toHaveValue("35");
  await dragHandle(page, "각도", 60, 0);
  await expect(angle).not.toHaveValue("35");
  await expect(page.getByRole("spinbutton", { name: "반경 mm" })).toHaveValue("500");
  await expect(page.getByRole("spinbutton", { name: "휘는 범위 %" })).toHaveValue("100");

  await page.getByRole("button", { name: /Path → Sweep/ }).click();
  await expect(page.getByLabel("3D Path Point")).toBeVisible();
  await expect(page.getByRole("button", { name: "조절: Path 2" })).toBeVisible();
  await page.getByRole("button", { name: /Profile → Revolve/ }).click();
  await expect(page.getByLabel("Profile (반지름, Y)")).toBeVisible();
  await expect(page.getByRole("button", { name: "조절: Profile 2" })).toBeVisible();

  await page.getByLabel("색상").fill("#22aa66");
  await expect(page.getByLabel("색상")).toHaveValue("#22aa66");
  await page.locator('input[type="file"][accept="image/*"]').last().setInputFiles(fixture);
  await expect(page.getByText(/이미지 확대 1.00×/)).toBeVisible();

  await page.getByRole("button", { name: "보기", exact: true }).click();
  await expect(page.getByRole("button", { name: /조절:/ })).toHaveCount(0);
  await page.getByRole("button", { name: "배치", exact: true }).click();
  await expect(page.getByRole("button", { name: "조절: 이동 X" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("nested Outliner hierarchy, world/local transform, locks, isolate and history", async ({ page }) => {
  const errors = trackCriticalErrors(page);
  await openBuilder(page);
  await addNamedPart(page, "Box", "Part A");
  await addNamedPart(page, "Cylinder", "Part B");
  await addNamedPart(page, "Sphere", "Part C");
  await addNamedPart(page, "Cone", "Part D");

  await page.locator(".asset-root-row").click();
  await expect(page.locator(".asset-root-row")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "전체 Asset 선택" })).toBeVisible();

  await page.getByRole("button", { name: "Part B", exact: true }).click();
  await page.getByRole("button", { name: "Part C", exact: true }).click({ modifiers: ["Shift"] });
  await page.locator('[title="그룹"]').click();
  await page.locator(".tree-name-input").fill("Group B");
  await page.getByRole("button", { name: "Part A", exact: true }).click();
  await page.getByRole("button", { name: "Group B", exact: true }).click({ modifiers: ["Shift"] });
  await page.locator('[title="그룹"]').click();
  await page.locator(".tree-name-input").fill("Group A");
  await expect(page.getByRole("navigation", { name: "현재 선택 경로" })).toContainText("Group A");
  await expect(page.locator(".tree-row")).toHaveCount(6);

  const positionX = page.getByRole("spinbutton", { name: "위치 X mm" });
  await positionX.fill("300");
  await positionX.press("Enter");
  await page.getByRole("button", { name: "Part A", exact: true }).click();
  await expect(positionX).toHaveValue("0");
  await page.getByRole("button", { name: "World" }).click();
  await expect(positionX).toHaveValue("300");

  await page.getByRole("button", { name: "Group B", exact: true }).click();
  const rotationY = page.getByRole("spinbutton", { name: "회전 Y °" });
  await rotationY.fill("45");
  await rotationY.press("Enter");
  await page.getByRole("button", { name: "Part B", exact: true }).click();
  await expect(rotationY).toHaveValue("45");
  await page.getByRole("button", { name: "Local" }).click();
  await expect(rotationY).toHaveValue("0");
  await positionX.fill("200");
  await positionX.press("Enter");

  await page.getByRole("button", { name: "Part A", exact: true }).click();
  await page.getByRole("button", { name: "Group B", exact: true }).click();
  const groupBRow = page.locator(".tree-row.selected");
  await groupBRow.dragTo(page.locator(".asset-root-row"));
  await page.getByRole("button", { name: "Part B", exact: true }).click();
  await page.getByRole("button", { name: "World" }).click();
  const worldAfterReparent = await positionX.inputValue();
  await page.getByRole("button", { name: "실행 취소" }).click();
  await page.getByRole("button", { name: "다시 실행" }).click();
  await expect(positionX).toHaveValue(worldAfterReparent);

  await page.getByRole("button", { name: "Part A", exact: true }).click();
  await page.getByRole("button", { name: "Group B", exact: true }).click();
  await page.locator('[title="그룹 해제"]').click();
  await expect(page.locator(".tree-row")).toHaveCount(5);
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(page.locator(".tree-row")).toHaveCount(6);

  await page.getByRole("button", { name: "Part A", exact: true }).click();
  const selectedRow = page.locator(".tree-row.selected");
  await selectedRow.getByTitle("위치 잠금").click();
  await expect(positionX).toBeDisabled();
  await expect(page.getByLabel("색상")).toBeEnabled();
  await selectedRow.getByTitle("위치 잠금").click();

  await page.getByRole("button", { name: "Group A", exact: true }).click();
  await page.locator(".tree-row.selected").getByTitle("숨기기").click();
  await expect(page.locator(".tree-row.selected").getByTitle("표시")).toBeVisible();
  await page.locator(".tree-row.selected").getByTitle("표시").click();

  await page.getByRole("button", { name: "Part C", exact: true }).click();
  await page.getByRole("button", { name: "선택 항목만 보기" }).click();
  await expect(page.getByRole("button", { name: "전체 보기로 돌아가기" })).toBeVisible();
  await page.getByRole("button", { name: "전체 보기로 돌아가기" }).click();

  const search = page.getByPlaceholder("Part / Group 검색");
  await search.fill("Part C");
  await expect(page.getByRole("button", { name: "Part C", exact: true }).or(page.locator('.tree-name-input[value="Part C"]'))).toBeVisible();
  await search.fill("");

  await page.getByRole("button", { name: "Group B", exact: true }).click();
  await page.locator(".tree-row.selected").getByTitle("편집 잠금").click();
  await page.getByRole("button", { name: "Part B", exact: true }).click();
  await expect(page.getByText(/편집 잠금 · Parent/)).toBeVisible();
  await expect(positionX).toBeDisabled();
  await page.keyboard.press("Delete");
  await expect(page.locator(".tree-row")).toHaveCount(6);
  await page.getByRole("button", { name: "Group B", exact: true }).click();
  await page.locator(".tree-row.selected").getByTitle("편집 잠금").click();

  await page.keyboard.press(process.platform === "darwin" ? "Meta+C" : "Control+C");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
  await expect(page.locator(".tree-row")).toHaveCount(9);
  await expect(page.locator(".tree-name-input")).toHaveValue(/Group B 복사본/);
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(page.locator(".tree-row")).toHaveCount(6);
  await page.getByRole("button", { name: "다시 실행" }).click();
  await expect(page.locator(".tree-row")).toHaveCount(9);
  expect(errors).toEqual([]);
});

test("physical KeyX deletion is IME-safe and independent of the Korean key value", async ({ page }) => {
  const errors = trackCriticalErrors(page);
  await openBuilder(page);
  await addNamedPart(page, "Box", "삭제 테스트");
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ㅌ", code: "KeyX", isComposing: true, bubbles: true })));
  await expect(page.locator(".tree-row")).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ㅌ", code: "KeyX", isComposing: false, bubbles: true })));
  await expect(page.locator(".tree-row")).toHaveCount(0);

  await addNamedPart(page, "Box", "입력 보호");
  await page.locator(".tree-name-input").focus();
  await page.keyboard.press("x");
  await expect(page.locator(".tree-row")).toHaveCount(1);
  await page.getByRole("button", { name: "보기", exact: true }).focus();
  await page.keyboard.press("x");
  await expect(page.locator(".tree-row")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Wall, floor and Asset material images change actual WebGL canvas pixels", async ({ page }) => {
  const errors = trackCriticalErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "공간 스튜디오 열기" }).click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  const surfaces = ["back", "left", "right", "floor"] as const;
  for (const surface of surfaces) {
    const view = surface === "back" ? "정면" : surface === "left" ? "우측" : surface === "right" ? "좌측" : "상단";
    await page.getByRole("button", { name: view, exact: true }).click();
    const card = page.getByTestId(`surface-${surface}`);
    const before = await canvas.screenshot();
    await uploadSurface(card);
    const withImage = await waitForCanvasChange(canvas, before, `${surface} add`);
    if (surface === "back") {
      await card.getByRole("button", { name: "채우기" }).click();
      await card.locator('input[type="range"]').nth(0).fill("1.7");
      await card.locator('input[type="range"]').nth(1).fill("35");
      await card.locator('input[type="range"]').nth(2).fill("-20");
      await card.getByRole("spinbutton").fill("25");
      await card.getByRole("spinbutton").press("Enter");
      const transformed = await waitForCanvasChange(canvas, withImage, "back UV transform");
      await card.locator('input[type="file"]').setInputFiles(fixture);
      const replaced = await waitForCanvasChange(canvas, transformed, "back map A to map B");
      await page.getByRole("button", { name: "실행 취소" }).click();
      const undone = await waitForCanvasChange(canvas, replaced, "back upload undo");
      await page.getByRole("button", { name: "다시 실행" }).click();
      await waitForCanvasChange(canvas, undone, "back upload redo");
    }
    const beforeRemove = await canvas.screenshot();
    await card.getByRole("button", { name: "이미지 제거" }).click();
    await expect(card.getByRole("button", { name: "이미지 제거" })).toHaveCount(0);
    await waitForCanvasChange(canvas, beforeRemove, `${surface} remove`);
  }

  await page.getByRole("button", { name: "뒤로" }).click();
  await page.getByRole("button", { name: "3D 오브젝트 만들기" }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  const assetCanvas = page.locator("canvas");
  const boxBefore = await assetCanvas.screenshot();
  await page.getByLabel("영역").selectOption({ label: "앞" });
  await page.locator('input[type="file"][accept="image/*"]').last().setInputFiles(contrastFixture);
  const boxMapped = await waitForCanvasChange(assetCanvas, boxBefore, "Box material region add");
  await page.getByRole("button", { name: "이미지 제거" }).click();
  await waitForCanvasChange(assetCanvas, boxMapped, "Box material region remove");

  await page.getByRole("button", { name: /Sketch → Extrude/ }).click();
  await page.getByLabel("영역").selectOption({ label: "앞" });
  const extrudeBefore = await assetCanvas.screenshot();
  await page.locator('input[type="file"][accept="image/*"]').last().setInputFiles(fixture);
  await waitForCanvasChange(assetCanvas, extrudeBefore, "Extrude material region add");
  expect(errors).toEqual([]);
});

test("Space camera, instance list, snap, clearance and drag history support planning", async ({ page }) => {
  const errors = trackCriticalErrors(page);
  await openBuilder(page);
  await addNamedPart(page, "Box", "Planning Block");
  await page.getByRole("button", { name: "공간에 추가" }).click();
  await expect(page.getByTestId("space-studio")).toBeVisible();
  const addButton = page.locator(".asset-add-list button").first();
  await addButton.click();
  await addButton.click();
  await expect(page.locator(".space-instance-row")).toHaveCount(3);

  await page.getByLabel("이동 Snap").selectOption("50");
  await page.getByLabel("회전 Snap").selectOption("90");
  const rows = page.locator(".space-instance-row");
  await rows.nth(0).locator(".space-instance-select").click();
  await page.getByRole("spinbutton", { name: "X mm" }).fill("-1000");
  await page.getByRole("spinbutton", { name: "X mm" }).press("Enter");
  await rows.nth(2).locator(".space-instance-select").click();
  await page.getByRole("spinbutton", { name: "X mm" }).fill("1000");
  await page.getByRole("spinbutton", { name: "X mm" }).press("Enter");
  await rows.nth(1).locator(".space-instance-select").click();
  await page.getByRole("spinbutton", { name: "X mm" }).fill("123");
  await page.getByRole("spinbutton", { name: "X mm" }).press("Enter");
  await expect(page.getByRole("spinbutton", { name: "X mm" })).toHaveValue("100");
  await page.getByRole("spinbutton", { name: "Z mm" }).fill("177");
  await page.getByRole("spinbutton", { name: "Z mm" }).press("Enter");
  await expect(page.getByRole("spinbutton", { name: "Z mm" })).toHaveValue("200");
  await page.getByRole("spinbutton", { name: "Y 회전 °" }).fill("50");
  await page.getByRole("spinbutton", { name: "Y 회전 °" }).press("Enter");
  await expect(page.getByRole("spinbutton", { name: "Y 회전 °" })).toHaveValue("90");
  await expect(page.getByRole("heading", { name: "벽 / 경계까지 거리" })).toBeVisible();

  const canvas = page.locator("canvas");
  const perspective = await canvas.screenshot();
  await page.getByRole("button", { name: "상단", exact: true }).click();
  const top = await waitForCanvasChange(canvas, perspective, "top camera preset");
  await page.getByRole("button", { name: "정면", exact: true }).click();
  const front = await waitForCanvasChange(canvas, top, "front camera preset");
  await page.getByRole("button", { name: "원근", exact: true }).click();
  await waitForCanvasChange(canvas, front, "perspective camera preset");
  await page.getByRole("button", { name: "전체 공간 보기" }).click();
  await page.getByRole("button", { name: "선택 항목 보기" }).click();

  await page.getByRole("button", { name: "상단", exact: true }).click();
  await page.getByRole("button", { name: "배치", exact: true }).click();
  const startX = await page.getByRole("spinbutton", { name: "X mm" }).inputValue();
  const startZ = await page.getByRole("spinbutton", { name: "Z mm" }).inputValue();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 110, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  const draggedX = await page.getByRole("spinbutton", { name: "X mm" }).inputValue();
  const draggedZ = await page.getByRole("spinbutton", { name: "Z mm" }).inputValue();
  expect([draggedX, draggedZ]).not.toEqual([startX, startZ]);
  expect(Number(draggedX) % 50).toBe(0);
  expect(Number(draggedZ) % 50).toBe(0);
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(page.getByRole("spinbutton", { name: "X mm" })).toHaveValue(startX);
  await expect(page.getByRole("spinbutton", { name: "Z mm" })).toHaveValue(startZ);
  await page.getByRole("button", { name: "다시 실행" }).click();
  await expect(page.getByRole("spinbutton", { name: "X mm" })).toHaveValue(draggedX);

  await page.locator(".space-instance-row.selected").getByRole("button", { name: /복제/ }).click();
  await expect(page.locator(".space-instance-row")).toHaveCount(4);
  await page.locator(".space-instance-row.selected").getByRole("button", { name: /삭제/ }).click();
  await expect(page.locator(".space-instance-row")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("Asset, images and Space restore from a portable project archive", async ({ page }) => {
  const errors = trackCriticalErrors(page);
  await openBuilder(page);
  await addNamedPart(page, "Box", "Portable Part");
  await page.locator(".asset-name-input").fill("Portable Asset");
  await page.getByLabel("색상").fill("#2266aa");
  await page.locator('input[type="file"][accept="image/*"]').last().setInputFiles(fixture);
  await expect(page.getByText(/이미지 확대/)).toBeVisible();
  await page.locator('input[accept*=".glb"]').setInputFiles("tests/fixtures/measured.glb");
  await expect(page.getByRole("button", { name: "원본 재질" })).toBeVisible();
  await page.getByRole("button", { name: "공간에 추가" }).click();
  await expect(page.getByText("ASSET INSTANCE")).toBeVisible();
  await page.locator("summary").nth(0).click();
  await expect(page.getByRole("button", { name: "진회색 바닥" })).toBeVisible();
  await expect(page.getByRole("button", { name: "기본 타일" })).toBeVisible();
  await page.locator('input[type="color"]').nth(0).fill("#1a2b3c");
  await page.locator('details input[type="file"]').nth(0).setInputFiles(fixture);
  await expect(page.getByText(/확대 1.00×/)).toBeVisible();
  await page.locator("summary").nth(1).click();
  await page.locator('input[type="color"]').nth(1).fill("#ccddaa");
  await page.locator('details input[type="file"]').nth(1).setInputFiles(fixture);
  await expect(page.getByText(/확대 1.00×/)).toHaveCount(2);
  await page.getByRole("button", { name: "+90°" }).click();
  await expect(page.getByRole("spinbutton", { name: "Y 회전 °" })).toHaveValue("90");
  await page.getByRole("button", { name: "뒤로" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "프로젝트 저장" }).click();
  const download = await downloadPromise;
  const projectFile = await download.path();
  expect(projectFile).toBeTruthy();
  await expect(page.locator(".app-notice")).toContainText(".hustle3d 파일을 저장했습니다");

  await page.reload();
  await page.locator('input[accept*=".hustle3d"]').setInputFiles(projectFile!);
  await expect(page.locator(".app-notice")).toContainText("Geometry·Hierarchy·Material·Space가 복원되었습니다");
  await page.getByRole("button", { name: "공간 스튜디오 열기" }).click();
  await expect(page.getByText("ASSET INSTANCE")).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Y 회전 °" })).toHaveValue("90");
  await page.locator("summary").nth(0).click();
  await page.locator("summary").nth(1).click();
  await expect(page.locator('input[type="color"]').nth(0)).toHaveValue("#1a2b3c");
  await expect(page.locator('input[type="color"]').nth(1)).toHaveValue("#ccddaa");
  await expect(page.getByText(/확대 1.00×/)).toHaveCount(2);
  await page.getByRole("button", { name: "다시 편집", exact: true }).click();
  await expect(page.locator(".asset-name-input")).toHaveValue("Portable Asset");
  await expect(page.getByLabel("색상")).toHaveValue("#2266aa");
  await expect(page.getByText(/이미지 확대/)).toBeVisible();
  await page.getByRole("button", { name: "measured.glb", exact: true }).click();
  await expect(page.getByRole("button", { name: "원본 재질" })).toBeVisible();
  expect(errors).toEqual([]);
});
