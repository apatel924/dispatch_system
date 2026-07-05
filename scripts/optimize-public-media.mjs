#!/usr/bin/env node
/**
 * Converts PNG/JPEG under `public/` to WebP and re-encodes existing WebPs in place
 * when the result is smaller. Path-aware quality settings for Quick-Run Express assets.
 *
 * Usage:
 *   npm run optimize:images
 *   npm run optimize:images -- --keep-sources
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..", "public");
const rasterExt = new Set([".png", ".jpg", ".jpeg"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith(".")) continue;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function normRel(absPath) {
  return path.relative(root, absPath).split(path.sep).join("/");
}

function webpOptionsFor(relPath, meta) {
  const lower = relPath.toLowerCase();
  const base = path.basename(lower);
  const hasAlpha = meta.hasAlpha === true;

  if (lower.includes("/brand/") || base.includes("logo")) {
    const px = (meta.width || 0) * (meta.height || 0);
    if (px > 1_600_000) return { quality: 88, alphaQuality: 100, effort: 6 };
    return { lossless: true, effort: 6 };
  }

  if (lower.includes("/heroes/")) {
    return { quality: 78, effort: 6, smartSubsample: true };
  }

  if (lower.includes("/mockups/")) {
    return { quality: 82, alphaQuality: 96, effort: 6 };
  }

  if (lower.includes("/marketing/")) {
    return { quality: 80, effort: 6, smartSubsample: true };
  }

  if (!hasAlpha) {
    return { quality: 80, effort: 6, smartSubsample: true };
  }

  return { quality: 89, alphaQuality: 100, effort: 6 };
}

async function convertRaster(srcPath, keepSources) {
  const rel = normRel(srcPath);
  const base = path.basename(srcPath, path.extname(srcPath));
  const destPath = path.join(path.dirname(srcPath), `${base}.webp`);
  const input = sharp(srcPath);
  const meta = await input.metadata();
  const opts = webpOptionsFor(`${base}.webp`, meta);
  await input.webp(opts).toFile(destPath);
  const before = fs.statSync(srcPath).size;
  const after = fs.statSync(destPath).size;
  console.log(`${rel} → ${normRel(destPath)} (${before} → ${after} bytes) [new]`);
  if (!keepSources) fs.unlinkSync(srcPath);
}

async function tightenWebp(absPath) {
  const rel = normRel(absPath);
  const before = fs.statSync(absPath).size;
  const meta = await sharp(absPath).metadata();
  const opts = webpOptionsFor(rel, meta);
  const tmp = `${absPath}.opt-tmp.webp`;
  try {
    await sharp(absPath).webp(opts).toFile(tmp);
  } catch (e) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw e;
  }
  const after = fs.statSync(tmp).size;
  if (after <= before) {
    fs.renameSync(tmp, absPath);
    const pct = before ? Math.round((1 - after / before) * 1000) / 10 : 0;
    console.log(`${rel}: ${before} → ${after} bytes (${pct >= 0 ? `−${pct}%` : "same"})`);
    return { saved: before - after };
  }
  fs.unlinkSync(tmp);
  console.log(`${rel}: keep ${before} bytes (re-encode would be ${after})`);
  return { saved: 0 };
}

async function main() {
  const keepSources = process.argv.includes("--keep-sources");
  let savedTotal = 0;

  const rasters = walk(root).filter((p) => {
    const base = path.basename(p);
    if (base.includes(".writing.")) return false;
    return rasterExt.has(path.extname(p).toLowerCase());
  });
  for (const p of rasters.sort()) await convertRaster(p, keepSources);
  if (rasters.length) console.log(`— Converted ${rasters.length} raster file(s).\n`);

  const webps = walk(root).filter((p) => path.extname(p).toLowerCase() === ".webp");
  for (const p of webps.sort()) {
    const { saved } = await tightenWebp(p);
    savedTotal += saved;
  }

  console.log(
    webps.length
      ? `\nDone — processed ${webps.length} WebP(s). Net savings: ~${savedTotal} bytes.`
      : "\nDone."
  );
}

await main();
