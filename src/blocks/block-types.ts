/**
 * The nineteen page-block types this platform renders, and the artifact
 * kinds the developer platform authors. Both unions are declared here and
 * nowhere else — see the header comment on `block-props.ts` for why the
 * block registries in `design-system` and `tenant-sites` should key off
 * `BLOCK_TYPES`, not their own literal object keys.
 */

export const BLOCK_TYPES = [
  // Marketing
  "hero",
  "trust",
  "features",
  "social",
  "steps",
  "pricing",
  "faq",
  "testimonials",
  "cta",
  "logos",
  // Content
  "text",
  "image",
  "gallery",
  "columns",
  // CMS + commerce
  "collection",
  "contact",
  "cart",
  // Chrome
  "navbar",
  "footer",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Mirrors `BuilderArtifact.artifactType` in
 * `data/prisma/schema/developer-platform.prisma` exactly — a value here with
 * no counterpart there (or vice versa) is a bug in one of the two, and there
 * is no automated check for that yet (the Prisma schema can't import a TS
 * const). Keep them in sync by hand until plan phase P3 adds one.
 */
export const ARTIFACT_TYPES = [
  "FORM",
  "ADVANCED_FORM",
  "WORKFLOW",
  "BPMN_PROCESS",
  "DASHBOARD",
  "DATA_OBJECT",
  "RULE_SET",
  "API_ENDPOINT",
  "SCRIPT",
  "MOBILE_APP",
  "ETL_PIPELINE",
  "THEME",
  "PAGE",
  "COLLECTION",
  "BLOG_POST",
  "MENU",
  "ASSET",
  "SEO_PROFILE",
  "AB_TEST",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
