/**
 * Copy to src/lib/metadata.ts. next-canonical-guard accepts pageMetadata() as a canonical.
 * Every page calls it, so every page gets a self-referential canonical.
 *
 *   export const metadata = pageMetadata({
 *     path: "/pricing",
 *     title: "…",
 *     description: "…",
 *   });
 *
 * Dynamic routes call it from generateMetadata with the resolved path.
 */
import type { Metadata } from "next";

/** Absolute site URL. Read it from wherever the project keeps its identity constants. */
const METADATA_BASE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://example.com";

export function absoluteUrl(path = "/"): string {
  return path === "/" ? METADATA_BASE : `${METADATA_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export type PageMetadataArgs = {
  path: string;
  title: string;
  description: string;
  image?: { url: string; width: number; height: number; alt: string };
};

export function pageMetadata({ path, title, description, image }: PageMetadataArgs): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { url, title, description, ...(image ? { images: [image] } : {}) },
  };
}
