import type { AssetDefinition } from "@/studio/domain/types";
import { normalizeAsset } from "@/studio/domain/defaults";

const LIBRARY_KEY = "hustle-3d-studio.asset-library.v1";

export interface AssetLibraryRepository {
  list(): AssetDefinition[];
  save(asset: AssetDefinition): void;
  remove(assetId: string): void;
}

function available() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const localAssetLibrary: AssetLibraryRepository = {
  list() {
    if (!available()) return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? "[]") as AssetDefinition[];
      return Array.isArray(parsed) ? parsed.filter((asset) => asset?.schemaVersion === 1 && Array.isArray(asset.nodes)).map(normalizeAsset) : [];
    } catch {
      return [];
    }
  },
  save(asset) {
    if (!available()) return;
    const assets = this.list();
    const next = [...assets.filter((candidate) => candidate.id !== asset.id), normalizeAsset(structuredClone(asset))];
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
  },
  remove(assetId) {
    if (!available()) return;
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(this.list().filter((asset) => asset.id !== assetId)));
  },
};
