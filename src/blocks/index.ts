/**
 * `@kannan19302/shared/blocks` — the block/artifact contract shared between
 * the API (server-side validation) and every block renderer (client-side
 * type-checking).
 *
 * Framework-free by design: this package has no React dependency, so a
 * NestJS service can import it for zod validation without pulling in a UI
 * library. The renderer-facing half of this contract — a
 * `createBlockRegistry` factory that turns `BlockType` into a typed
 * `{ [K in BlockType]: React.FC<BlockPropsFor<K>> }` map — belongs in
 * `@kannan19302/ui/blocks` instead, for the same reason in reverse.
 *
 * Consumers:
 *   - `design-system/src/blocks/registry.tsx` and
 *     `developer-platform/src/components/builder/blocks/registry.tsx` (soon
 *     to collapse into one, per plan phase P5) key `BLOCK_REGISTRY` off
 *     `BLOCK_TYPES` and check it with `satisfies { [K in BlockType]: ... }`,
 *     so a missing renderer is a compile error, not a runtime blank block.
 *   - `api/src/developer/platform/sites-pages.controller.ts` (plan phase P4,
 *     not yet built) validates page-save request bodies with
 *     `pageDocumentSchema`.
 *   - `api/.../publish.service.ts` (plan phase P4) re-validates before
 *     writing a `PublishedProjection` row and stamps `schemaVersion`.
 *
 * Deliberately NOT included yet: a `PublishedProjection` payload schema.
 * That table doesn't exist until plan phase P1's `PublishedProjection`
 * model ships (see `data/prisma/schema/developer-platform.prisma`) and the
 * P4 publish path is built — a schema for a table and a write path that
 * don't exist yet would be unvalidated speculation, not a contract.
 */

export { BLOCK_TYPES, ARTIFACT_TYPES } from "./block-types";
export type { BlockType, ArtifactType } from "./block-types";

export { BLOCK_PROP_SCHEMAS } from "./block-props";
export type { BlockPropsFor } from "./block-props";

export { blockNodeSchema, CURRENT_BLOCK_SCHEMA_VERSION } from "./block-tree";
export type { BlockNode } from "./block-tree";

export { pageDocumentSchema, migrateBlockDocument } from "./page-document";
export type { PageDocument } from "./page-document";
