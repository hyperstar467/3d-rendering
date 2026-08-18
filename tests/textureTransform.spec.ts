import { expect, test } from "@playwright/test";
import { getTextureUvTransform } from "../lib/textureTransform";

test("contain/cover UV transform preserves a 4:3 image on a 6000x2500 wall", () => {
  const settings = { fit: "contain" as const, zoom: 1, x: 0, y: 0, rotation: 0 };
  const contain = getTextureUvTransform(6000 / 2500, 4 / 3, settings);
  expect(contain.repeatX).toBeCloseTo(1.8, 6);
  expect(contain.repeatY).toBeCloseTo(1, 6);

  const cover = getTextureUvTransform(6000 / 2500, 4 / 3, { ...settings, fit: "cover" });
  expect(cover.repeatX).toBeCloseTo(1, 6);
  expect(cover.repeatY).toBeCloseTo(5 / 9, 6);
});

test("UV editing changes transform without changing either aspect ratio", () => {
  const transformed = getTextureUvTransform(6000 / 2500, 4 / 3, {
    fit: "contain",
    zoom: 1.5,
    x: 20,
    y: -10,
    rotation: 90,
  });
  expect(transformed.repeatX).toBeCloseTo(1.2, 6);
  expect(transformed.repeatY).toBeCloseTo(2 / 3, 6);
  expect(transformed.offsetX).toBeCloseTo(-0.1, 6);
  expect(transformed.offsetY).toBeCloseTo(0.05, 6);
  expect(transformed.rotation).toBeCloseTo(Math.PI / 2, 6);
});
