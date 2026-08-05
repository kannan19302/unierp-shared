# unierp-shared

**Layer L1 — Foundation** of the [UniERP](../unierp-platform) platform.
Depends on: L0.

## What this is

Cross-cutting types, validators, constants, the permission registry and outbox contracts.

## The invariant this repository owns

`hasPermission` lives here. It refuses to let a tenant-scoped grant — including a bare `*` — satisfy a control-plane permission. That refusal closed a confirmed escalation.

## The rule that applies everywhere

A repository may depend only on published artifacts of a **strictly lower
layer** — never sideways within a layer, never upward. A cycle is not
discouraged; it is unrepresentable, because the lower layer's package cannot
name the higher one.

See the [platform overview](../unierp-platform/README.md) for the full map, and
[`PLATFORM_ARCHITECTURE.md`](../ERPSys/docs/PLATFORM_ARCHITECTURE.md) § 4.2 for
the reasoning.

## Licence

AGPL-3.0.
