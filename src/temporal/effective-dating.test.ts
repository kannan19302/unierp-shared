import { describe, it, expect } from "vitest";
import {
  assertValidInterval,
  validateNoOverlaps,
  resolveEffectiveAt,
  reconstructHierarchyAt,
  applyReorganizationSlice,
  TemporalIntervalError,
  HierarchyNode,
} from "./effective-dating";

describe("Effective Dating Engine (FND-P1-002)", () => {
  describe("Interval validation & overlap prevention", () => {
    it("accepts open-ended and valid bounded intervals", () => {
      expect(() =>
        assertValidInterval(new Date("2026-01-01"), new Date("2026-06-30"))
      ).not.toThrow();
      expect(() =>
        assertValidInterval(new Date("2026-01-01"), null)
      ).not.toThrow();
    });

    it("rejects backwards intervals (from >= to)", () => {
      expect(() =>
        assertValidInterval(new Date("2026-06-30"), new Date("2026-01-01"))
      ).toThrow(TemporalIntervalError);
    });

    it("detects overlapping version slices for the same entity", () => {
      const slices = [
        {
          id: "v1",
          entityId: "dept-engineering",
          validFrom: new Date("2026-01-01"),
          validTo: new Date("2026-07-01"),
          data: { name: "Engineering" },
        },
        {
          id: "v2",
          entityId: "dept-engineering",
          validFrom: new Date("2026-06-01"), // overlaps by 1 month
          validTo: null,
          data: { name: "Product Engineering" },
        },
      ];

      expect(() => validateNoOverlaps(slices)).toThrow(TemporalIntervalError);
    });
  });

  describe("Point-in-time entity resolution", () => {
    const history = [
      {
        id: "v1",
        entityId: "cc-101",
        validFrom: new Date("2025-01-01T00:00:00Z"),
        validTo: new Date("2026-01-01T00:00:00Z"),
        data: { name: "R&D Initial", budget: 100000 },
      },
      {
        id: "v2",
        entityId: "cc-101",
        validFrom: new Date("2026-01-01T00:00:00Z"),
        validTo: new Date("2026-07-01T00:00:00Z"),
        data: { name: "R&D Expanded", budget: 250000 },
      },
      {
        id: "v3",
        entityId: "cc-101",
        validFrom: new Date("2026-07-01T00:00:00Z"),
        validTo: null,
        data: { name: "R&D Global", budget: 500000 },
      },
    ];

    it("resolves exact historical slice at past timestamp", () => {
      const past = resolveEffectiveAt(history, new Date("2025-06-15T12:00:00Z"));
      expect(past?.id).toBe("v1");
      expect(past?.data.name).toBe("R&D Initial");
    });

    it("resolves intermediate historical slice", () => {
      const intermediate = resolveEffectiveAt(history, new Date("2026-03-15T12:00:00Z"));
      expect(intermediate?.id).toBe("v2");
      expect(intermediate?.data.budget).toBe(250000);
    });

    it("resolves current open-ended slice", () => {
      const current = resolveEffectiveAt(history, new Date("2026-09-03T12:00:00Z"));
      expect(current?.id).toBe("v3");
      expect(current?.data.name).toBe("R&D Global");
    });

    it("returns null for timestamp prior to entity inception", () => {
      const beforeInception = resolveEffectiveAt(history, new Date("2024-12-31T23:59:59Z"));
      expect(beforeInception).toBeNull();
    });
  });

  describe("Point-in-time organizational hierarchy tree reconstruction", () => {
    // Org structure:
    // Root: ACME Corp (org-1)
    // Dept: Product (dept-1, parent: org-1)
    // Dept: Frontend (dept-2, initially parent: dept-1, reorganized to org-1 directly on 2026-07-01)
    const nodes: HierarchyNode<{ name: string }>[] = [
      {
        id: "org-v1",
        entityId: "org-1",
        parentId: null,
        validFrom: new Date("2025-01-01"),
        validTo: null,
        data: { name: "ACME Corp" },
      },
      {
        id: "dept1-v1",
        entityId: "dept-1",
        parentId: "org-1",
        validFrom: new Date("2025-01-01"),
        validTo: null,
        data: { name: "Product Dept" },
      },
      // Frontend under Product initially:
      {
        id: "dept2-v1",
        entityId: "dept-2",
        parentId: "dept-1",
        validFrom: new Date("2025-01-01"),
        validTo: new Date("2026-07-01"),
        data: { name: "Frontend Team" },
      },
      // Frontend reporting directly to ACME Corp from July 1:
      {
        id: "dept2-v2",
        entityId: "dept-2",
        parentId: "org-1",
        validFrom: new Date("2026-07-01"),
        validTo: null,
        data: { name: "Frontend Platform Unit" },
      },
    ];

    it("reconstructs pre-reorganization hierarchy tree (before July 2026)", () => {
      const treeBefore = reconstructHierarchyAt(nodes, new Date("2026-03-01"));
      expect(treeBefore.length).toBe(1);
      const root = treeBefore[0];
      expect(root.entityId).toBe("org-1");
      expect(root.children.length).toBe(1); // dept-1

      const productDept = root.children[0];
      expect(productDept.entityId).toBe("dept-1");
      expect(productDept.children.length).toBe(1); // dept-2 is child of dept-1
      expect(productDept.children[0].entityId).toBe("dept-2");
      expect(productDept.children[0].data.name).toBe("Frontend Team");
    });

    it("reconstructs post-reorganization hierarchy tree (after July 2026)", () => {
      const treeAfter = reconstructHierarchyAt(nodes, new Date("2026-08-01"));
      expect(treeAfter.length).toBe(1);
      const root = treeAfter[0];
      expect(root.entityId).toBe("org-1");

      // dept-1 and dept-2 are now sibling children under org-1
      expect(root.children.length).toBe(2);
      const childIds = root.children.map((c) => c.entityId);
      expect(childIds).toContain("dept-1");
      expect(childIds).toContain("dept-2");

      const productDept = root.children.find((c) => c.entityId === "dept-1")!;
      expect(productDept.children.length).toBe(0); // no longer parent of dept-2
    });
  });

  describe("Reorganization slice management", () => {
    it("cleanly slices an existing node at effective date and creates successor", () => {
      const original: HierarchyNode<{ title: string }>[] = [
        {
          id: "pos-1-v1",
          entityId: "pos-1",
          parentId: "dept-sales",
          validFrom: new Date("2026-01-01"),
          validTo: null,
          data: { title: "Sales Associate" },
        },
      ];

      const effectiveDate = new Date("2026-10-01");
      const updated = applyReorganizationSlice(
        original,
        "pos-1",
        "dept-enterprise-sales",
        { title: "Senior Enterprise Lead" },
        effectiveDate
      );

      expect(updated.length).toBe(2);
      const priorSlice = updated.find((s) => s.id === "pos-1-v1")!;
      expect(priorSlice.validTo?.toISOString()).toBe(effectiveDate.toISOString());

      const nextSlice = updated.find((s) => s.id !== "pos-1-v1")!;
      expect(nextSlice.parentId).toBe("dept-enterprise-sales");
      expect(nextSlice.validFrom.toISOString()).toBe(effectiveDate.toISOString());
      expect(nextSlice.validTo).toBeNull();
      expect(nextSlice.data.title).toBe("Senior Enterprise Lead");

      // Continuity check
      expect(() => validateNoOverlaps(updated)).not.toThrow();
    });
  });
});
