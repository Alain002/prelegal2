// Works around a Next.js static export bug on Windows (runs after `next build`).
//
// For link prefetching, the export writes one file per route segment, named after the segment's
// path with "/" turned into "." (e.g. draft/__next.!KGFwcCk.draft.__PAGE__.txt), which is the name
// the browser asks for. On Windows the paths it starts from use "\", which isn't replaced, so the
// files land in folders instead (draft/__next.!KGFwcCk/draft/__PAGE__.txt) and every prefetch 404s.
// This moves them to the expected names. Elsewhere (Linux, the Docker build) it finds nothing to do.

import { readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../out", import.meta.url));

/** Every file under `dir`, as paths relative to it. */
async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name).slice(dir.length + 1));
}

async function flatten(dir) {
  let moved = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("__next.")) {
      for (const file of await filesUnder(path)) {
        const flat = [entry.name, ...file.split(/[\\/]/)].join(".");
        await rename(join(path, file), join(dir, flat));
        moved++;
      }
      await rm(path, { recursive: true });
    } else if (entry.name !== "_next") {
      moved += await flatten(path);
    }
  }
  return moved;
}

const moved = await flatten(OUT);
if (moved) console.log(`flatten-segments: renamed ${moved} prefetch segment files in out/`);
