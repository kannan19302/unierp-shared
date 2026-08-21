/**
 * A page (or a page section) is a tree of blocks: `{ type, props, children }`.
 * `blockNodeSchema` is recursive — a `columns` or `navbar` block can nest
 * other blocks as children, even though none of today's nineteen block
 * components read a `children` prop yet. Modelling the tree as recursive now
 * costs nothing and avoids a breaking schema-version bump the day a
 * container block ships.
 */

import { z } from "zod";
import { BLOCK_TYPES } from "./block-types";
import { BLOCK_PROP_SCHEMAS } from "./block-props";

const blockTypeSchema = z.enum(BLOCK_TYPES);

export interface BlockNode {
  id: string;
  type: (typeof BLOCK_TYPES)[number];
  props: Record<string, unknown>;
  children?: BlockNode[];
  /** Server-evaluated visibility rule, e.g. `{ field: "plan", equals: "pro" }`.
   * Shape intentionally loose here — the rules engine (plan builder `rules`)
   * owns the actual predicate grammar; this package only needs to know a
   * visibility rule can be attached to a block, not interpret one. */
  visibility?: Record<string, unknown>;
}

export const blockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      type: blockTypeSchema,
      props: z.record(z.string(), z.unknown()),
      children: z.array(blockNodeSchema).optional(),
      visibility: z.record(z.string(), z.unknown()).optional(),
    })
    .superRefine((node, ctx) => {
      const schema = BLOCK_PROP_SCHEMAS[node.type];
      const result = schema.safeParse(node.props);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["props", ...issue.path],
          });
        }
      }
    }),
);

/**
 * The current schema version this module produces/validates. Bump on any
 * breaking change to `blockNodeSchema` or a per-type prop schema, and add a
 * step to `migrate.ts`'s chain — never rewrite an old version's meaning out
 * from under stored documents.
 */
export const CURRENT_BLOCK_SCHEMA_VERSION = 1;
