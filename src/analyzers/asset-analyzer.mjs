import { existsSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ASSET_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".mp4",
  ".woff",
  ".woff2",
]);

function findAssets(dir, assetList = []) {
  if (!existsSync(dir)) return assetList;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (["node_modules", ".git", ".next", "dist", "build"].includes(entry)) continue;
    const full = join(dir, entry);
    try {
      const s = statSync(full);
      if (s.isDirectory()) {
        findAssets(full, assetList);
      } else {
        const ext = extname(entry).toLowerCase();
        if (ASSET_EXTENSIONS.has(ext)) {
          assetList.push({
            file: full,
            name: entry,
            ext,
            sizeBytes: s.size,
            sizeKB: Math.round(s.size / 1024),
          });
        }
      }
    } catch {
      // skip
    }
  }
  return assetList;
}

/**
 * Inspects media assets for oversized files (>500KB) and uncompressed legacy formats.
 * @param {string} rootDir
 * @returns {Array<object>}
 */
export function analyzeAssets(rootDir = process.cwd(), options = {}) {
  const maxKB = options.maxAssetSizeKB || 500;
  const assetDirs = [
    join(rootDir, "public"),
    join(rootDir, "src", "assets"),
    join(rootDir, "assets"),
  ].filter(existsSync);

  const allAssets = [];
  for (const d of assetDirs) {
    findAssets(d, allAssets);
  }

  const findings = [];

  for (const asset of allAssets) {
    const relPath = relative(rootDir, asset.file).replace(/\\/g, "/");

    // 1. Oversized asset check
    if (asset.sizeKB > maxKB) {
      findings.push({
        type: "oversized-asset",
        severity: asset.sizeKB > 1500 ? "P1" : "P2",
        file: relPath,
        sizeKB: asset.sizeKB,
        confidence: "High",
        problem: `Asset is very large (${(asset.sizeKB / 1024).toFixed(1)} MB).`,
        recommendation: `Compress image or convert to WebP/AVIF to reduce initial bundle and page load payload.`,
      });
    }

    // 2. Legacy uncompressed raster formats (> 200 KB PNG or JPG)
    if (asset.sizeKB > 200 && (asset.ext === ".png" || asset.ext === ".jpg" || asset.ext === ".jpeg")) {
      findings.push({
        type: "legacy-format",
        severity: "P3",
        file: relPath,
        sizeKB: asset.sizeKB,
        confidence: "Medium",
        problem: `Image is stored in uncompressed legacy format (${asset.ext}).`,
        recommendation: `Converting to modern WebP or AVIF format can yield 40%–80% size savings with equal visual quality.`,
      });
    }
  }

  return findings;
}
