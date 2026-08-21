/**
 * One zod schema per block type, keyed by `BlockType`. This is the contract
 * both `design-system/src/blocks/*.tsx` (the marketing eight) and
 * `developer-platform/src/components/builder/blocks/RichBlocks.tsx` (the
 * remaining eleven) should be validated against — server-side at page save
 * (`sites-pages.controller.ts`, plan phase P4) and client-side via the
 * `satisfies` clause described in `index.ts`.
 *
 * Coverage is honest, not complete. The eight marketing blocks
 * (hero/trust/features/social/steps/pricing/faq/testimonials) have real
 * TypeScript prop interfaces in `design-system/src/blocks/*.tsx`, so their
 * schemas below are transcribed from those interfaces directly. The eleven
 * `RichBlocks.tsx` components are typed `{ ...}: any` today — there is no
 * source-of-truth interface to transcribe. Their schemas below are reverse
 * -engineered from each component's destructured parameters (a real,
 * verified field list, not a guess) but use `.passthrough()` so an
 * as-yet-unknown prop already flowing through the untyped components does
 * not fail validation it was never subject to before. Tightening
 * `RichBlocks.tsx` itself to real interfaces, then dropping `.passthrough()`
 * here to match, is follow-up work — not a corner cut silently: every
 * `.passthrough()` below has this same comment attached.
 */

import { z } from "zod";
import type { BlockType } from "./block-types";

const heroBlockPropsSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  primaryCta: z.string().optional(),
  secondaryCta: z.string().optional(),
  primaryUrl: z.string().optional(),
  secondaryUrl: z.string().optional(),
  alignment: z.enum(["left", "center"]).optional(),
});

const trustBlockPropsSchema = z.object({
  title: z.string().optional(),
  logos: z.array(z.string()).optional(),
});

const featureItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
});
const featuresBlockPropsSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  features: z.array(featureItemSchema).optional(),
});

const testimonialItemSchema = z.object({
  quote: z.string(),
  name: z.string(),
  role: z.string(),
  company: z.string(),
});
const socialBlockPropsSchema = z.object({
  title: z.string().optional(),
  testimonials: z.array(testimonialItemSchema).optional(),
});

const stepItemSchema = z.object({ title: z.string(), description: z.string() });
const stepsBlockPropsSchema = z.object({
  title: z.string().optional(),
  steps: z.array(stepItemSchema).optional(),
});

const planItemSchema = z.object({
  name: z.string(),
  price: z.string(),
  features: z.array(z.string()),
  recommended: z.boolean().optional(),
});
const pricingBlockPropsSchema = z.object({
  title: z.string().optional(),
  plans: z.array(planItemSchema).optional(),
});

const faqItemSchema = z.object({ question: z.string(), answer: z.string() });
const faqBlockPropsSchema = z.object({
  title: z.string().optional(),
  faqs: z.array(faqItemSchema).optional(),
});

// ── RichBlocks.tsx — reverse-engineered from destructured params, see the
// module comment above for what `.passthrough()` means here. ──

const ctaBlockPropsSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    buttonText: z.string().optional(),
    buttonUrl: z.string().optional(),
  })
  .passthrough();

const logosBlockPropsSchema = z
  .object({
    title: z.string().optional(),
    logos: z.union([z.array(z.string()), z.string()]).optional(),
  })
  .passthrough();

const textBlockPropsSchema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
    align: z.enum(["left", "center", "right"]).optional(),
  })
  .passthrough();

const imageBlockPropsSchema = z
  .object({
    url: z.string().optional(),
    caption: z.string().optional(),
    rounded: z.boolean().optional(),
    maxWidth: z.number().optional(),
  })
  .passthrough();

const galleryBlockPropsSchema = z
  .object({
    images: z.union([z.array(z.string()), z.string()]).optional(),
    columns: z.number().optional(),
    title: z.string().optional(),
  })
  .passthrough();

const columnsBlockPropsSchema = z
  .object({
    col1Title: z.string().optional(),
    col1Body: z.string().optional(),
    col2Title: z.string().optional(),
    col2Body: z.string().optional(),
    col3Title: z.string().optional(),
    col3Body: z.string().optional(),
  })
  .passthrough();

const collectionBlockPropsSchema = z
  .object({
    collectionSlug: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    layout: z.enum(["grid", "list"]).optional(),
    columns: z.number().optional(),
    limit: z.number().optional(),
    featuredOnly: z.boolean().optional(),
    tenantSlug: z.string().optional(),
  })
  .passthrough();

const contactFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string().optional(),
  required: z.boolean().optional(),
});
const contactBlockPropsSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    formName: z.string().optional(),
    buttonText: z.string().optional(),
    fields: z.array(contactFieldSchema).optional(),
    tenantSlug: z.string().optional(),
  })
  .passthrough();

const cartBlockPropsSchema = z
  .object({
    title: z.string().optional(),
    tenantSlug: z.string().optional(),
  })
  .passthrough();

const navLinkSchema = z.object({ label: z.string(), url: z.string() });
const navbarBlockPropsSchema = z
  .object({
    brand: z.string().optional(),
    links: z.union([z.array(navLinkSchema), z.string()]).optional(),
    showCart: z.boolean().optional(),
  })
  .passthrough();

const footerBlockPropsSchema = z
  .object({
    brand: z.string().optional(),
    tagline: z.string().optional(),
    links: z.union([z.array(navLinkSchema), z.string()]).optional(),
    copyright: z.string().optional(),
  })
  .passthrough();

/** `BLOCK_TYPES` × schema, exhaustively — the `satisfies Record<BlockType,
 * ...>` below is what makes adding a block type without a schema a compile
 * error rather than a silent gap. */
export const BLOCK_PROP_SCHEMAS = {
  hero: heroBlockPropsSchema,
  trust: trustBlockPropsSchema,
  features: featuresBlockPropsSchema,
  social: socialBlockPropsSchema,
  steps: stepsBlockPropsSchema,
  pricing: pricingBlockPropsSchema,
  faq: faqBlockPropsSchema,
  testimonials: socialBlockPropsSchema, // SocialProofBlock renders both keys
  cta: ctaBlockPropsSchema,
  logos: logosBlockPropsSchema,
  text: textBlockPropsSchema,
  image: imageBlockPropsSchema,
  gallery: galleryBlockPropsSchema,
  columns: columnsBlockPropsSchema,
  collection: collectionBlockPropsSchema,
  contact: contactBlockPropsSchema,
  cart: cartBlockPropsSchema,
  navbar: navbarBlockPropsSchema,
  footer: footerBlockPropsSchema,
} satisfies Record<BlockType, z.ZodTypeAny>;

export type BlockPropsFor<T extends BlockType> = z.infer<
  (typeof BLOCK_PROP_SCHEMAS)[T]
>;
