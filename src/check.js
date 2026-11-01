// Finds the sitewide-canonical trap in a Next.js App Router project.
//
// Next merges a layout's metadata into every page below it. A canonical set in a layout is
// therefore inherited by each page that does not set its own, and each of those pages tells
// Google it is a duplicate of the layout's URL. Nothing errors and every page renders, so the
// usual symptom is a site that stays "Duplicate, Google chose different canonical" for months.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const PAGE = /^page\.(tsx|ts|jsx|js|mdx)$/;
const LAYOUT = /^layout\.(tsx|ts|jsx|js)$/;
const CANONICAL_IN_ALTERNATES = /alternates\s*:\s*\{[^}]*\bcanonical\b/s;
const NOINDEX = /index\s*:\s*false|noindex/;

/** Returns the app directory for a project root, or null when there is none. */
export function findAppDir(root) {
  for (const candidate of [join(root, "src", "app"), join(root, "app")]) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
  }
  return null;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function layoutIn(dir) {
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    if (LAYOUT.test(name)) return join(dir, name);
  }
  return null;
}

/**
 * Checks one project.
 *
 * @param {string} root project root (the folder holding src/app or app)
 * @param {{ helpers?: string[] }} [options] function names that set a canonical for the page,
 *   for example a project's own `pageMetadata()` wrapper
 * @returns {{ appDir: string, problems: Problem[], pages: number }}
 *
 * @typedef {{ kind: "layout-canonical" | "inherits-canonical" | "no-canonical", file: string, detail: string }} Problem
 */
export function check(root, options = {}) {
  const appDir = findAppDir(root);
  if (!appDir) throw new Error(`No app directory under ${root} (looked for src/app and app).`);

  const helpers = ["pageMetadata", ...(options.helpers ?? [])];
  const setsOwn = (src) =>
    CANONICAL_IN_ALTERNATES.test(src) || helpers.some((h) => new RegExp(`\\b${h}\\s*\\(`).test(src));

  const files = walk(appDir);
  const layouts = files.filter((f) => LAYOUT.test(f.split(sep).pop()));
  const pages = files.filter((f) => PAGE.test(f.split(sep).pop()));
  const problems = [];

  // Every layout with a canonical is a problem, the root one most of all.
  const canonicalLayouts = new Set();
  const noindexLayouts = new Set();
  for (const file of layouts) {
    const layoutSrc = readFileSync(file, "utf8");
    if (NOINDEX.test(layoutSrc)) noindexLayouts.add(dirname(file));
    if (CANONICAL_IN_ALTERNATES.test(layoutSrc)) {
      canonicalLayouts.add(dirname(file));
      const isRoot = dirname(file) === appDir;
      problems.push({
        kind: "layout-canonical",
        file: relative(root, file),
        detail: isRoot
          ? "The root layout sets alternates.canonical. Every page that does not set its own inherits it and reports itself as a duplicate of that URL."
          : "This layout sets alternates.canonical. Every page below it that does not set its own inherits it.",
      });
    }
  }

  for (const file of pages) {
    const src = readFileSync(file, "utf8");
    if (setsOwn(src)) continue;
    const rel = relative(root, file);
    let noindex = NOINDEX.test(src);

    // Walk up to the app dir. The nearest layout with a canonical is the one the page inherits;
    // any layout on the way that sets noindex makes the page noindex too.
    let dir = dirname(file);
    let inherited = null;
    while (dir.startsWith(appDir)) {
      if (noindexLayouts.has(dir)) noindex = true;
      if (!inherited && canonicalLayouts.has(dir)) inherited = layoutIn(dir);
      if (dir === appDir) break;
      dir = dirname(dir);
    }

    if (inherited) {
      problems.push({
        kind: "inherits-canonical",
        file: rel,
        detail: `Inherits the canonical from ${relative(root, inherited)}${noindex ? " (page is noindex, so low impact)" : ""}.`,
      });
    } else if (!noindex) {
      problems.push({
        kind: "no-canonical",
        file: rel,
        detail: "Sets no canonical. Google will pick one for it.",
      });
    }
  }

  return { appDir, problems, pages: pages.length };
}
