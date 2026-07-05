#!/usr/bin/env node
/**
 * Removes near-white studio backgrounds from PNGs via edge flood-fill, trims to opaque
 * pixels, and writes `.webp` with alpha. Source PNGs are removed after processing.
 *
 * Usage:
 *   npm run process:knockout-backgrounds
 *   npm run process:knockout-backgrounds -- public/images/brand
 *   npm run process:knockout-backgrounds -- public/images/brand/logo.png
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIST_SQ_MAX = 62 * 62;
const SHADOW_DIST_SQ_MAX = 78 * 78;

function colorDistSq(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return dr * dr + dg * dg + db * db;
}

function matchesBackground(r, g, b, br, bg, bb, maxDistSq = DIST_SQ_MAX) {
  return colorDistSq(r, g, b, br, bg, bb) < maxDistSq;
}

function averageEdgeBackground(data, w, h) {
  let br = 0;
  let bg = 0;
  let bb = 0;
  let count = 0;

  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      br += data[i];
      bg += data[i + 1];
      bb += data[i + 2];
      count++;
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      br += data[i];
      bg += data[i + 1];
      bb += data[i + 2];
      count++;
    }
  }

  return { br: br / count, bg: bg / count, bb: bb / count };
}

function floodFillBackground(data, out, w, h, br, bg, bb) {
  const visited = new Uint8Array(w * h);
  const queue = [];

  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const idx = y * w + x;
      const i = idx * 4;
      if (matchesBackground(data[i], data[i + 1], data[i + 2], br, bg, bb)) {
        visited[idx] = 1;
        queue.push(idx);
      }
    }
  }

  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      const i = idx * 4;
      if (matchesBackground(data[i], data[i + 1], data[i + 2], br, bg, bb)) {
        visited[idx] = 1;
        queue.push(idx);
      }
    }
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const i = idx * 4;
    out[i + 3] = 0;

    const x = idx % w;
    const y = (idx / w) | 0;

    if (x > 0) {
      const nidx = idx - 1;
      if (!visited[nidx]) {
        const ni = nidx * 4;
        if (matchesBackground(data[ni], data[ni + 1], data[ni + 2], br, bg, bb)) {
          visited[nidx] = 1;
          queue.push(nidx);
        }
      }
    }
    if (x < w - 1) {
      const nidx = idx + 1;
      if (!visited[nidx]) {
        const ni = nidx * 4;
        if (matchesBackground(data[ni], data[ni + 1], data[ni + 2], br, bg, bb)) {
          visited[nidx] = 1;
          queue.push(nidx);
        }
      }
    }
    if (y > 0) {
      const nidx = idx - w;
      if (!visited[nidx]) {
        const ni = nidx * 4;
        if (matchesBackground(data[ni], data[ni + 1], data[ni + 2], br, bg, bb)) {
          visited[nidx] = 1;
          queue.push(nidx);
        }
      }
    }
    if (y < h - 1) {
      const nidx = idx + w;
      if (!visited[nidx]) {
        const ni = nidx * 4;
        if (matchesBackground(data[ni], data[ni + 1], data[ni + 2], br, bg, bb)) {
          visited[nidx] = 1;
          queue.push(nidx);
        }
      }
    }
  }
}

function expandShadowRemoval(data, out, w, h, br, bg, bb) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (out[i + 3] === 0) continue;
        if (!matchesBackground(data[i], data[i + 1], data[i + 2], br, bg, bb, SHADOW_DIST_SQ_MAX)) {
          continue;
        }

        let touchesTransparent = false;
        if (x > 0 && out[i - 4 + 3] === 0) touchesTransparent = true;
        else if (x < w - 1 && out[i + 4 + 3] === 0) touchesTransparent = true;
        else if (y > 0 && out[i - w * 4 + 3] === 0) touchesTransparent = true;
        else if (y < h - 1 && out[i + w * 4 + 3] === 0) touchesTransparent = true;

        if (touchesTransparent) {
          out[i + 3] = 0;
          changed = true;
        }
      }
    }
  }
}

async function processOne(imagePath) {
  const pipeline = sharp(imagePath).ensureAlpha();
  const { data, info } = await pipeline.clone().raw().toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  if (info.channels !== 4) {
    console.warn(`[skip] ${path.basename(imagePath)} — expected RGBA`);
    return false;
  }

  const { br, bg, bb } = averageEdgeBackground(data, w, h);
  const out = Buffer.from(data);
  floodFillBackground(data, out, w, h, br, bg, bb);
  expandShadowRemoval(data, out, w, h, br, bg, bb);

  const base = path.basename(imagePath, path.extname(imagePath));
  const outPath = path.join(path.dirname(imagePath), `${base}.webp`);
  const tmpPath = `${outPath}.writing`;

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 12 })
    .webp({ quality: 86, alphaQuality: 96, effort: 6 })
    .toFile(tmpPath);

  await fs.promises.rename(tmpPath, outPath);
  await fs.promises.unlink(imagePath);
  console.log(`[ok] ${path.basename(imagePath)} → ${path.basename(outPath)}`);
  return true;
}

function collectPngTargets(inputArg) {
  const defaultDir = path.resolve(import.meta.dirname, "..", "public", "images");
  const target = inputArg
    ? path.resolve(process.cwd(), inputArg)
    : defaultDir;

  if (!fs.existsSync(target)) {
    console.error(`Path not found: ${target}`);
    process.exit(1);
  }

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return path.extname(target).toLowerCase() === ".png" ? [target] : [];
  }

  const out = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else if (name.name.endsWith(".png")) out.push(full);
    }
  }
  walk(target);
  return out.sort();
}

const targets = collectPngTargets(process.argv[2]);

if (targets.length === 0) {
  console.error("No PNG files found to process.");
  process.exit(1);
}

let processed = 0;
for (const file of targets) {
  if (await processOne(file)) processed++;
}

console.log(`Done — processed ${processed} image(s).`);
