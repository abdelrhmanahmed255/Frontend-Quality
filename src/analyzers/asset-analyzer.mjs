import { existsSync } from "node:fs";
import { readdir, stat, readFile } from "node:fs/promises";
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

async function findAssets(dir, assetList = []) {
  if (!existsSync(dir)) return assetList;
  try {
    const entries = await readdir(dir);
    await Promise.all(entries.map(async (entry) => {
      if (["node_modules", ".git", ".next", "dist", "build"].includes(entry)) return;
      const full = join(dir, entry);
      try {
        const s = await stat(full);
        if (s.isDirectory()) {
          await findAssets(full, assetList);
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
    }));
  } catch {
    // skip
  }
  return assetList;
}

// Files that can reference an asset by name: code, styles, markup, docs, and config/manifests.
const REFERENCE_FILE_RE = /\.(jsx?|tsx?|mjs|cjs|vue|svelte|astro|css|scss|sass|less|html?|mdx?|json|webmanifest|ya?ml|xml)$/i;
const SKIPPED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", "audit-reports"]);
// Browsers and platforms request these by convention, so they are used without any reference.
const CONVENTIONAL_ASSET_RE = /^(favicon|apple-touch-icon|android-chrome|mstile|safari-pinned-tab|browserconfig)/i;

async function collectReferenceText(dir, chunks = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return chunks;
  }
  await Promise.all(entries.map(async (entry) => {
    if (SKIPPED_DIRS.has(entry.name)) return;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectReferenceText(full, chunks);
    } else if (REFERENCE_FILE_RE.test(entry.name) && !entry.name.includes("lock")) {
      try {
        chunks.push(await readFile(full, "utf-8"));
      } catch {
        // skip unreadable files
      }
    }
  }));
  return chunks;
}

/**
 * Inspects media assets for oversized files (>500KB), uncompressed legacy formats,
 * and files that nothing in the project refers to.
 * @param {string} rootDir
 * @returns {Array<object>}
 */
export async function analyzeAssets(rootDir = process.cwd(), options = {}) {
  const maxKB = options.maxAssetSizeKB || 500;
  const assetDirs = [
    join(rootDir, "public"),
    join(rootDir, "src", "assets"),
    join(rootDir, "assets"),
  ].filter(existsSync);

  const allAssets = [];
  await Promise.all(assetDirs.map(d => findAssets(d, allAssets)));

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

  // 3. Potentially unreferenced assets: the file name appears nowhere in the project's text files.
  if (allAssets.length > 0) {
    const referenceText = (await collectReferenceText(rootDir)).join("\n");
    for (const asset of allAssets) {
      if (CONVENTIONAL_ASSET_RE.test(asset.name) || referenceText.includes(asset.name)) continue;
      findings.push({
        type: "unreferenced-asset",
        severity: "P3",
        file: relative(rootDir, asset.file).replace(/\\/g, "/"),
        sizeKB: asset.sizeKB,
        confidence: "Medium",
        problem: `Asset '${asset.name}' is not referenced by name in any source, style, markup, or config file.`,
        recommendation: `Check for dynamic paths (e.g. \`/images/\${name}.png\`) or external usage, then delete the file if it is truly unused.`,
      });
    }
  }

  return findings;
}
