/**
 * The document a page builder saves and the public renderer reads —
 * validates `WebSitePage.blocks` (`data/prisma/schema/web.prisma`) server
 * -side at write time, once `sites-pages.controller.ts` (plan phase P4)
 * exists to call it.
 */

import { z } from "zod";
import { blockNodeSchema, CURRENT_BLOCK_SCHEMA_VERSION } from "./block-tree";

export const pageDocumentSchema = z.object({
  schemaVersion: z.number().int().positive().default(CURRENT_BLOCK_SCHEMA_VERSION),
  blocks: z.array(blockNodeSchema),
});

export type PageDocument = z.infer<typeof pageDocumentSchema>;

/**
 * Forward-only migration chain. `migrateBlockDocument` walks a stored
 * document from whatever version it was saved at up to
 * `CURRENT_BLOCK_SCHEMA_VERSION`, one step at a time, so a page saved under
 * schema v1 never has to be rewritten in the database the moment v2 ships —
 * it is migrated in memory on read instead.
 *
 * Empty today because there has only ever been one version. Add a step here
 * the day `blockNodeSchema` changes in a way that isn't backward-compatible
 * (a renamed field, a prop that changed shape) — additive changes
 * (a new optional prop, a new block type) don't need a step at all.
 */
const MIGRATIONS: Record<number, (doc: PageDocument) => PageDocument> = {};

export function migrateBlockDocument(doc: PageDocument): PageDocument {
  let current = doc;
  while (current.schemaVersion < CURRENT_BLOCK_SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];
    if (!step) {
      throw new Error(
        `No migration registered from block schema v${current.schemaVersion} ` +
          `to v${current.schemaVersion + 1}.`,
      );
    }
    current = step(current);
  }
  return current;
}
