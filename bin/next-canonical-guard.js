#!/usr/bin/env node
import { resolve } from "node:path";
import { check } from "../src/check.js";

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage: next-canonical-guard [project-dir] [--helper name]... [--warn-missing]

Fails when a Next.js App Router layout sets alternates.canonical, or when a page inherits one.

  --helper name    a function that sets a page's canonical (pageMetadata is always accepted)
  --warn-missing   report pages with no canonical at all, but do not fail on them`);
  process.exit(0);
}

const helpers = [];
let dir = ".";
let warnMissing = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--helper") helpers.push(args[++i]);
  else if (args[i] === "--warn-missing") warnMissing = true;
  else dir = args[i];
}

let result;
try {
  result = check(resolve(dir), { helpers });
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

const label = {
  "layout-canonical": "LAYOUT  ",
  "inherits-canonical": "INHERITS",
  "no-canonical": "MISSING ",
};
let failing = 0;
for (const p of result.problems) {
  const fatal = p.kind !== "no-canonical" || !warnMissing;
  if (fatal) failing++;
  console.log(`${fatal ? "✗" : "!"} ${label[p.kind]} ${p.file}\n    ${p.detail}`);
}

console.log(
  failing
    ? `\n${failing} problem(s) across ${result.pages} page(s).`
    : `✓ ${result.pages} page(s) checked. No layout canonicals${warnMissing ? "" : ", every page sets its own"}.`,
);
process.exit(failing ? 1 : 0);
