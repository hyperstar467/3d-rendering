import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";

const IMAGE_4X3 = path.join(__dirname, "fixtures/surface-4x3.svg");

function makeGlb() {
  const positions = new Float32Array([
    -0.5, 0, -0.5,
    0.5, 0, -0.5,
    0, 1, 0.5,
  ]);
  const json = JSON.stringify({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.8, 0.15, 0.1, 1] } }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    buffers: [{ byteLength: positions.byteLength }],
  });
  const jsonBytes = Buffer.from(json);
  const jsonPaddedLength = Math.ceil(jsonBytes.length / 4) * 4;
  const binBytes = Buffer.from(positions.buffer);
  const totalLength = 12 + 8 + jsonPaddedLength + 8 + binBytes.length;
  const glb = Buffer.alloc(totalLength, 0x20);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(totalLength, 8);
  glb.writeUInt32LE(jsonPaddedLength, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonBytes.copy(glb, 20);
  const binHeader = 20 + jsonPaddedLength;
  glb.writeUInt32LE(binBytes.length, binHeader);
  glb.writeUInt32LE(0x004e4942, binHeader + 4);
  binBytes.copy(glb, binHeader + 8);
  return glb;
}

async function setInputValue(locator: Locator, value: string) {
  await locator.evaluate((element, next) => {
    const input = element as HTMLInputElement;
    input.value = next;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  }, value);
}

async function openFixturePanel(page: Page) {
  await page.getByRole("button", { name: "집기", exact: true }).click();
}

async function addPrimitive(page: Page) {
  await openFixturePanel(page);
  await page.getByRole("button", { name: "기타 집기" }).click();
  await page.getByRole("button", { name: "부스에 추가", exact: true }).click();
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-transform", /1000:1000:1000/);
}

async function uploadSurface(page: Page, target: "floor" | "back" | "left" | "right") {
  const editor = page.locator(`[data-testid='surface-${target}']`);
  await editor.locator("input[type=file]").setInputFiles(IMAGE_4X3);
  await expect(editor.locator("img")).toBeVisible();
  await expect(editor.getByText("처리 중")).toHaveCount(0);
  return editor;
}

async function addPhotoFixture(page: Page) {
  await openFixturePanel(page);
  await page.getByRole("button", { name: /면별 사진 집기/ }).click();
  const frontCard = page.getByText("정면 사진", { exact: true }).locator("xpath=ancestor::section[1]");
  await frontCard.locator("input[type=file]").setInputFiles(IMAGE_4X3);
  await expect(page.locator("[data-testid='photo-fixture-preview']")).toHaveAttribute("data-front-transform", /^contain:/);
  await page.getByRole("button", { name: /검수 후 부스에 추가/ }).click();
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-photo-assets", "1");
}

async function addGlbFixture(page: Page) {
  await openFixturePanel(page);
  await page.getByRole("button", { name: /GLB 직접 등록/ }).click();
  await page.locator("input[accept*='.glb']").setInputFiles({ name: "measured.glb", mimeType: "model/gltf-binary", buffer: makeGlb() });
  await expect(page.locator(".measurement-badge")).toContainText("1200 × 450 × 1800 mm · 실측 일치");
  const yRow = page.getByText(/^Y축 0°$/).locator("xpath=parent::*");
  await yRow.getByRole("button", { name: "+90°" }).click();
  await expect(page.locator(".measurement-badge")).toContainText("1200 × 450 × 1800 mm · 실측 일치");
  await page.getByRole("button", { name: /검수 후 부스에 추가/ }).click();
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-glb-assets", "1");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-testid='booth-scene']")).toBeVisible();
});

test("A: macOS Korean physical X, Delete and Backspace delete without affecting editors", async ({ page }) => {
  await addPrimitive(page);
  const name = page.getByLabel("이름", { exact: true });
  await name.focus();
  await name.evaluate((element) => element.dispatchEvent(new KeyboardEvent("keydown", { key: "ㅌ", code: "KeyX", bubbles: true })));
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-transform", /1000/);
  await name.blur();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ㅌ", code: "KeyX", isComposing: true, bubbles: true })));
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-transform", /1000/);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ㅌ", code: "KeyX", bubbles: true })));
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-transform", "");

  await addPrimitive(page);
  await page.keyboard.press("Backspace");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-transform", "");
  await addPrimitive(page);
  await page.keyboard.press("Delete");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-transform", "");
});

test("B-D: fixture, floor and wall native color input events update the scene live", async ({ page }) => {
  await addPrimitive(page);
  await setInputValue(page.getByLabel("선택 집기 색상"), "#1a2b3c");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-color", "#1a2b3c");

  await page.getByRole("button", { name: "공간", exact: true }).click();
  await setInputValue(page.getByLabel("바닥 기본 색상"), "#203040");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-floor-color", "#203040");
  await setInputValue(page.getByLabel("벽 기본 색상"), "#405060");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-wall-color", "#405060");
});

test("E-G: independent surface image keeps 4:3 source and settings after booth resize", async ({ page }) => {
  const editor = await uploadSurface(page, "back");
  const preview = editor.locator("img");
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth / image.naturalHeight)).toBeCloseTo(4 / 3, 5);
  const originalSource = await preview.getAttribute("src");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-back-surface", "image");
  await setInputValue(page.getByLabel("벽 기본 색상"), "#112233");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-back-surface", "image");
  await expect(editor.getByLabel("후면 벽 맞춤")).toHaveValue("contain");

  await page.getByLabel("가로 W").fill("7000");
  await page.getByRole("button", { name: /입력한 부스 크기 적용/ }).click();
  await expect(editor.getByText("7000 × 2500 mm")).toBeVisible();
  await expect(preview).toHaveAttribute("src", originalSource!);
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth / image.naturalHeight)).toBeCloseTo(4 / 3, 5);
});

test("H-I: photo UV sliders and primitive/photo/GLB color semantics are live and explicit", async ({ page }) => {
  await openFixturePanel(page);
  await page.getByRole("button", { name: /면별 사진 집기/ }).click();
  const frontCard = page.getByText("정면 사진", { exact: true }).locator("xpath=ancestor::section[1]");
  await frontCard.locator("input[type=file]").setInputFiles(IMAGE_4X3);
  const preview = page.locator("[data-testid='photo-fixture-preview']");
  for (const value of ["1.15", "1.45", "1.8"]) {
    await setInputValue(page.getByLabel("정면 zoom"), value);
    await expect(preview).toHaveAttribute("data-front-transform", new RegExp(`^contain:${value}`));
  }
  await setInputValue(page.getByLabel("정면 X position"), "37");
  await setInputValue(page.getByLabel("정면 Y position"), "-24");
  await expect(preview).toHaveAttribute("data-front-transform", "contain:1.8:37:-24:0");
  await setInputValue(page.getByLabel("사진 집기 색상"), "#abcdef");
  await expect(preview).toHaveAttribute("data-color", "#abcdef");
  await page.getByRole("button", { name: /검수 후 부스에 추가/ }).click();
  await expect(page.getByText("사진 없는 면 색상", { exact: true })).toBeVisible();

  await addGlbFixture(page);
  await expect(page.getByRole("button", { name: "원본 유지" })).toHaveClass(/active/);
  await expect(page.getByLabel("GLB override 색상")).toHaveCount(0);
  await page.getByRole("button", { name: "단색 override" }).click();
  await setInputValue(page.getByLabel("GLB override 색상"), "#2468ac");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-material-mode", "override");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-color", "#2468ac");
});

test("number drafts stay blank while editing and rotated footprints clamp inside the booth", async ({ page }) => {
  await addPrimitive(page);
  const inspectorNumbers = page.locator(".right-panel input[type=number]");
  const width = inspectorNumbers.nth(0);
  await width.click();
  await width.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await width.press("Backspace");
  await expect(width).toHaveValue("");
  await width.press("Enter");
  await expect(width).toHaveValue("1000");

  await width.fill("1200");
  await width.press("Enter");
  const depth = inspectorNumbers.nth(1);
  await depth.fill("450");
  await depth.press("Enter");
  await page.getByRole("button", { name: "90°" }).click();
  const x = inspectorNumbers.nth(3);
  await x.fill("2775");
  await x.press("Enter");
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-transform", /1200:450:1000:2775:0:90$/);
  await page.getByRole("button", { name: "0°" }).click();
  await expect(page.locator("[data-testid='booth-scene']")).toHaveAttribute("data-selected-transform", /1200:450:1000:2400:0:0$/);
});

test("J: portable project restores wall, photo and GLB assets after refresh", async ({ page }, testInfo) => {
  await uploadSurface(page, "back");
  await addPhotoFixture(page);
  await addGlbFixture(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /.pawplan 저장/ }).click();
  const download = await downloadPromise;
  const projectFile = testInfo.outputPath("roundtrip.pawplan");
  await download.saveAs(projectFile);

  await page.reload();
  const scene = page.locator("[data-testid='booth-scene']");
  await expect(scene).toHaveAttribute("data-surface-assets", "0");
  await page.locator("input[accept*='.pawplan']").setInputFiles(projectFile);
  await expect(scene).toHaveAttribute("data-surface-assets", "1");
  await expect(scene).toHaveAttribute("data-photo-assets", "1");
  await expect(scene).toHaveAttribute("data-glb-assets", "1");
  await expect(page.getByText("프로젝트와 포함된 모든 자산을 복원했습니다.")).toBeVisible();
});
