import type { ImageTransform } from "@/studio/domain/types";

export type TextureUvTransform = {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

export function getTextureUvTransform(
  surfaceAspect: number,
  imageAspect: number,
  settings: Pick<ImageTransform, "fit" | "zoom" | "x" | "y" | "rotation">,
): TextureUvTransform {
  const safeSurfaceAspect = Math.max(surfaceAspect, 0.0001);
  const safeImageAspect = Math.max(imageAspect, 0.0001);
  const horizontalRatio = safeSurfaceAspect / safeImageAspect;
  const verticalRatio = safeImageAspect / safeSurfaceAspect;
  const baseRepeatX = settings.fit === "cover" ? Math.min(1, horizontalRatio) : Math.max(1, horizontalRatio);
  const baseRepeatY = settings.fit === "cover" ? Math.min(1, verticalRatio) : Math.max(1, verticalRatio);
  const zoom = Math.max(settings.zoom, 0.01);

  return {
    repeatX: baseRepeatX / zoom,
    repeatY: baseRepeatY / zoom,
    offsetX: -(settings.x / 100) * 0.5,
    offsetY: -(settings.y / 100) * 0.5,
    rotation: (settings.rotation * Math.PI) / 180,
  };
}
