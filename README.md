# next-canonical-guard

One line in a Next.js root layout can drop a whole site from Google's index, and nothing in the
build will tell you. This tool finds that line and fails CI until it is gone.

```ts
// src/app/layout.tsx
export const metadata = {
  metadataBase: new URL("https://example.com"),
  alternates: { canonical: "https://example.com" }, // every page now claims to be the homepage
};
```

Next.js merges a layout's `metadata` into every page below it. A page that does not set its own
canonical inherits the layout's, so `/pricing`, `/blog/anything` and the rest each tell Google they
are a duplicate of the homepage. Google obliges. The pages still render perfectly, there is no
warning, and the usual symptom is Search Console filling up with **"Alternate page with proper
canonical tag"** or **"Duplicate, Google chose different canonical than user"** months later.

It is easy to write, because "add a canonical" sounds like a sitewide setting and the root layout
looks like the place for sitewide settings. Scaffolding tools and AI code generators produce it
routinely. Six of the seven production Next.js sites I checked in September 2026 had it.

## Use

```bash
npx github:popnetmedia/next-canonical-guard          # run in the project root
npx github:popnetmedia/next-canonical-guard ./apps/web
```

```
✗ LAYOUT   src/app/layout.tsx
    The root layout sets alternates.canonical. Every page that does not set its own inherits it and reports itself as a duplicate of that URL.
✗ INHERITS src/app/about/page.tsx
    Inherits the canonical from src/app/layout.tsx.

2 problem(s) across 4 page(s).
```

It exits 1 when it finds a problem, so it can sit in CI or a pre-build step:

```json
{ "scripts": { "prebuild": "next-canonical-guard" } }
```

### What it reports

| | Meaning | Fails? |
|---|---|---|
| `LAYOUT` | A layout (root or nested, route groups included) sets `alternates.canonical`. | Yes |
| `INHERITS` | A page sets no canonical of its own and picks one up from a layout. | Yes |
| `MISSING` | A page sets no canonical at all, so Google picks one. | Yes, unless `--warn-missing` |

Pages that are `noindex`, or sit under a layout that is, are not reported as missing.

### Options

- `--helper name`: a function in your project that sets a page's canonical, such as
  `--helper seoMetadata`. `pageMetadata()` is always accepted. Repeat the flag for several.
- `--warn-missing`: list pages with no canonical, without failing on them. Useful on a large site
  you are fixing one section at a time.

### From code

```js
import { check } from "next-canonical-guard";

const { problems, pages } = check(process.cwd(), { helpers: ["seoMetadata"] });
```

## The fix

Keep `metadataBase`, the title template and default Open Graph in the root layout. Remove
`alternates` from it. Give each page its own self-referencing canonical, and set dynamic routes'
canonicals in `generateMetadata` from the resolved slug.

[`examples/metadata.ts`](examples/metadata.ts) is a small helper that makes that the path of least
resistance:

```ts
export const metadata = pageMetadata({ path: "/pricing", title: "Pricing", description: "…" });

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return pageMetadata({ path: `/blog/${slug}`, title: slug, description: "…" });
}
```

## Limits

It reads source files with patterns. It does not run your app. A canonical built somewhere it
cannot see, such as a spread from another module, will be reported as missing; pass that
function with `--helper`. It covers the App Router only. The Pages Router has no metadata
inheritance, so it does not have this trap.

## License

MIT
