/**
 * UniERP Effective Dating & Temporal Hierarchy Versioning Engine (FND-P1-002)
 *
 * Implements bi-temporal/effective-dating intervals, point-in-time tree lookups,
 * interval overlap prevention, and reorganization slice management across
 * organizations, departments, positions, and cost centers.
 */

export interface EffectiveInterval<T = unknown> {
  id: string;
  entityId: string;
  validFrom: Date;
  validTo: Date | null;
  data: T;
}

export interface HierarchyNode<T = unknown> extends EffectiveInterval<T> {
  parentId: string | null;
}

export class TemporalIntervalError extends Error {
  constructor(message: string) {
    super(`[EffectiveDating] ${message}`);
    this.name = "TemporalIntervalError";
  }
}

/**
 * Validates that an interval is logically consistent (validFrom < validTo).
 */
export function assertValidInterval(from: Date, to: Date | null): void {
  if (to !== null && from.getTime() >= to.getTime()) {
    throw new TemporalIntervalError(
      `Invalid interval: validFrom (${from.toISOString()}) must be strictly earlier than validTo (${to.toISOString()})`
    );
  }
}

/**
 * Validates that an array of temporal slices for a single entity has no overlapping intervals.
 */
export function validateNoOverlaps<T>(slices: EffectiveInterval<T>[]): void {
  const sorted = [...slices].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (!current) continue;
    assertValidInterval(current.validFrom, current.validTo);

    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      if (!next) continue;
      if (current.validTo === null) {
        throw new TemporalIntervalError(
          `Entity ${current.entityId} has an open-ended slice (${current.validFrom.toISOString()} -> open) preceding another slice starting at ${next.validFrom.toISOString()}`
        );
      }
      if (current.validTo.getTime() > next.validFrom.getTime()) {
        throw new TemporalIntervalError(
          `Entity ${current.entityId} has overlapping slices: [${current.validFrom.toISOString()} -> ${current.validTo.toISOString()}] overlaps with [${next.validFrom.toISOString()}]`
        );
      }
    }
  }
}

/**
 * Resolves the single active version slice for an entity as of a given timestamp.
 */
export function resolveEffectiveAt<T>(
  slices: EffectiveInterval<T>[],
  asOf: Date
): EffectiveInterval<T> | null {
  validateNoOverlaps(slices);
  const target = asOf.getTime();

  for (const slice of slices) {
    const from = slice.validFrom.getTime();
    const to = slice.validTo ? slice.validTo.getTime() : Infinity;

    if (target >= from && target < to) {
      return slice;
    }
  }

  return null;
}

/**
 * Reconstructs an entire organizational hierarchy tree active as of a specific point-in-time.
 */
export interface ReconstructedNode<T = unknown> {
  entityId: string;
  parentId: string | null;
  validFrom: Date;
  validTo: Date | null;
  data: T;
  children: ReconstructedNode<T>[];
}

export function reconstructHierarchyAt<T>(
  nodes: HierarchyNode<T>[],
  asOf: Date
): ReconstructedNode<T>[] {
  // 1. Group slices by entityId
  const entityMap = new Map<string, HierarchyNode<T>[]>();
  for (const node of nodes) {
    if (!entityMap.has(node.entityId)) {
      entityMap.set(node.entityId, []);
    }
    entityMap.get(node.entityId)!.push(node);
  }

  // 2. Resolve active slice for each entity at asOf
  const activeNodes = new Map<string, ReconstructedNode<T>>();
  for (const [entityId, slices] of entityMap.entries()) {
    const active = resolveEffectiveAt(slices, asOf);
    if (active) {
      activeNodes.set(entityId, {
        entityId: active.entityId,
        parentId: (active as HierarchyNode<T>).parentId,
        validFrom: active.validFrom,
        validTo: active.validTo,
        data: active.data,
        children: [],
      });
    }
  }

  // 3. Build tree
  const rootNodes: ReconstructedNode<T>[] = [];
  for (const node of activeNodes.values()) {
    if (node.parentId && activeNodes.has(node.parentId)) {
      activeNodes.get(node.parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

/**
 * Creates a new organizational reorganization slice at an effective date.
 * Closes the existing slice at effectiveDate and creates a new forward slice.
 */
export function applyReorganizationSlice<T>(
  existingSlices: HierarchyNode<T>[],
  entityId: string,
  newParentId: string | null,
  newData: T,
  effectiveDate: Date
): HierarchyNode<T>[] {
  validateNoOverlaps(existingSlices);

  const activeSlice = resolveEffectiveAt(existingSlices, effectiveDate);
  const updatedSlices: HierarchyNode<T>[] = [];

  for (const slice of existingSlices) {
    if (activeSlice && slice.id === activeSlice.id) {
      // Close prior slice at effectiveDate
      updatedSlices.push({
        ...slice,
        validTo: new Date(effectiveDate.getTime()),
      });
    } else {
      updatedSlices.push(slice);
    }
  }

  // Add the new forward slice starting at effectiveDate
  const newSlice: HierarchyNode<T> = {
    id: `slice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entityId,
    parentId: newParentId,
    validFrom: new Date(effectiveDate.getTime()),
    validTo: activeSlice?.validTo && activeSlice.validTo.getTime() > effectiveDate.getTime()
      ? activeSlice.validTo
      : null,
    data: newData,
  };

  updatedSlices.push(newSlice);
  validateNoOverlaps(updatedSlices);

  return updatedSlices;
}
