import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const kinds = (r) => r.problems.map((p) => `${p.kind} ${p.file}`).sort();

test("root layout canonical is reported, with every page that inherits it", () => {
  const r = check(join(fixtures, "broken"));
  assert.deepEqual(kinds(r), [
    "inherits-canonical src/app/about/page.tsx",
    "inherits-canonical src/app/admin/page.tsx",
    "inherits-canonical src/app/page.tsx",
    "layout-canonical src/app/layout.tsx",
  ]);
});

test("a page with its own canonical is not reported", () => {
  const r = check(join(fixtures, "broken"));
  assert.ok(!r.problems.some((p) => p.file.endsWith("pricing/page.tsx")));
});

test("nested layouts inside route groups are caught", () => {
  const r = check(join(fixtures, "nested"));
  assert.deepEqual(kinds(r), [
    "inherits-canonical app/(marketing)/shop/[item]/page.tsx",
    "inherits-canonical app/(marketing)/shop/page.tsx",
    "layout-canonical app/(marketing)/shop/layout.tsx",
  ]);
});

test("pageMetadata() counts as a canonical; custom helpers need --helper", () => {
  assert.deepEqual(kinds(check(join(fixtures, "clean"))), ["no-canonical app/docs/page.tsx"]);
  assert.deepEqual(check(join(fixtures, "clean"), { helpers: ["seo"] }).problems, []);
});

test("pages under a noindex layout are not reported as missing", () => {
  const root = mkdtempSync(join(tmpdir(), "ncg-"));
  const write = (p, s) => {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), s);
  };
  write("app/layout.tsx", "export const metadata = {};");
  write("app/dashboard/layout.tsx", "export const metadata = { robots: { index: false } };");
  write("app/dashboard/settings/page.tsx", "'use client'; export default function P(){return null}");
  assert.deepEqual(check(root).problems, []);
});

test("a folder with no app directory throws", () => {
  assert.throws(() => check(fixtures), /No app directory/);
});
