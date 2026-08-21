import { describe, it, expect } from "vitest";
import {
  BLOCK_TYPES,
  BLOCK_PROP_SCHEMAS,
  pageDocumentSchema,
  migrateBlockDocument,
  CURRENT_BLOCK_SCHEMA_VERSION,
  type PageDocument,
} from "../index";

/**
 * These assert the properties the block contract exists to guarantee, not
 * that a particular block happens to have a particular field today.
 *
 * The point of `@kannan19302/shared/blocks` is that a page document which
 * parses here is safe for both renderers and for the API to store. A test
 * that only checked "hero accepts a title" would pass while that guarantee
 * quietly broke.
 */
describe("block schema contract", () => {
  it("has a prop schema for every declared block type", () => {
    // The `satisfies Record<BlockType, ...>` in block-props.ts makes this a
    // compile-time guarantee too, but that check disappears once the package
    // is consumed as compiled JS — this is the runtime half.
    for (const type of BLOCK_TYPES) {
      expect(BLOCK_PROP_SCHEMAS[type], `missing schema for "${type}"`).toBeDefined();
    }
    expect(Object.keys(BLOCK_PROP_SCHEMAS).sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it("accepts a well-formed page document", () => {
    const doc = {
      schemaVersion: 1,
      blocks: [
        { id: "b1", type: "hero", props: { title: "Hello", alignment: "center" } },
        { id: "b2", type: "faq", props: { faqs: [{ question: "Q?", answer: "A." }] } },
      ],
    };
    expect(pageDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects an unknown block type", () => {
    const result = pageDocumentSchema.safeParse({
      schemaVersion: 1,
      blocks: [{ id: "b1", type: "not-a-real-block", props: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid prop value and reports the path into the block", () => {
    // The path matters: a validation error the API surfaces to a builder UI
    // is only actionable if it says WHICH block and WHICH field.
    const result = pageDocumentSchema.safeParse({
      schemaVersion: 1,
      blocks: [{ id: "b1", type: "hero", props: { alignment: "diagonal" } }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(["blocks", 0, "props", "alignment"]);
    }
  });

  it("validates nested children recursively", () => {
    const bad = pageDocumentSchema.safeParse({
      schemaVersion: 1,
      blocks: [
        {
          id: "outer",
          type: "columns",
          props: {},
          children: [{ id: "inner", type: "hero", props: { alignment: "sideways" } }],
        },
      ],
    });
    expect(bad.success).toBe(false);

    const good = pageDocumentSchema.safeParse({
      schemaVersion: 1,
      blocks: [
        {
          id: "outer",
          type: "columns",
          props: {},
          children: [{ id: "inner", type: "hero", props: { alignment: "left" } }],
        },
      ],
    });
    expect(good.success).toBe(true);
  });

  it("lets an untyped RichBlocks prop through rather than failing a page that already renders", () => {
    // The eleven RichBlocks components are `: any` today, so their schemas
    // use .passthrough(). This asserts that deliberate looseness, so that
    // tightening RichBlocks later has to update this test on purpose rather
    // than discovering it as a surprise regression in production pages.
    const result = pageDocumentSchema.safeParse({
      schemaVersion: 1,
      blocks: [{ id: "b1", type: "columns", props: { col1Title: "A", somethingUndocumented: 42 } }],
    });
    expect(result.success).toBe(true);
  });

  it("is a no-op migration at the current version", () => {
    const doc: PageDocument = {
      schemaVersion: CURRENT_BLOCK_SCHEMA_VERSION,
      blocks: [{ id: "b1", type: "hero", props: {} }],
    };
    expect(migrateBlockDocument(doc)).toEqual(doc);
  });

  it("refuses to guess when a migration step is missing", () => {
    // Silently returning a document it cannot actually migrate would hand the
    // renderer a shape it does not understand. Failing loudly is the point.
    const doc = {
      schemaVersion: CURRENT_BLOCK_SCHEMA_VERSION - 1,
      blocks: [],
    } as unknown as PageDocument;
    expect(() => migrateBlockDocument(doc)).toThrow(/No migration registered/);
  });
});
