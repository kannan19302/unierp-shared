<!-- UniERP-Agent-Protocol: 1.1.0 -->
# UniERP Repository Agent Entrypoint: Shared Primitives (`shared`)

This repository is one delivery unit in the UniERP polyrepo. Before analysis, planning, review, or mutation, every
AI agent from every provider MUST read and follow:

1. the workspace entrypoint at [`../AGENTS.md`](../AGENTS.md);
2. the canonical standard at
   [`../platform/docs/standards/AI_AGENT_DEVELOPMENT_PROTOCOL.md`](../platform/docs/standards/AI_AGENT_DEVELOPMENT_PROTOCOL.md);
3. the owning platform documents selected through
   [`../platform/docs/PLATFORM_CATALOG.md`](../platform/docs/PLATFORM_CATALOG.md).

If the workspace entrypoint or canonical standard is unavailable, the protocol bundle is incomplete. The agent
MUST stop before mutation and report the missing dependency. This bootstrap adds no weaker or conflicting rules.
Repository-specific additions may be appended below only when they narrow implementation behavior without
redefining platform ownership, security, contracts, or cross-platform standards.

---

## 1. Repository Identity & Mission

- **Repository**: `shared`
- **Platform Owner**: `PLT-OPS` (Core Platform & Operational Tooling)
- **Architectural Layer**: **Layer 1 (Cross-Platform Libraries) & Layer 2 (Framework)**
- **Mission**: Single authoritative repository for shared domain primitives, mathematical utilities, configuration presets, and microservice runtime building blocks.

---

## 2. Monorepo Workspace Structure

Governed as a clean, disciplined pnpm workspace:
- **`packages/kernel` (`.`)**: `@kannan19302/shared` — core utilities, math, crypto helpers, validation logic (Layer 1).
- **`config`**: `@kannan19302/config` — shared TypeScript, ESLint, and Prettier configurations (Layer 1).
- **`framework`**: `@kannan19302/framework` — runtime server/client framework primitives, ListView, FilterBar, Module definitions (Layer 2).

---

## 3. Industrial Software Engineering Invariants

1. **Downwards-Only Dependencies**:
   - `shared` can import from Layer 0 (`contracts`).
   - `shared` must NEVER import from Layer 3 (`api`, `idp`), Layer 4 (`business-suite`, `provider-admin`), or higher.
2. **Deterministic Mathematical Functions**:
   - High-precision decimal arithmetic helpers; zero float approximations for monetary operations.
3. **Clean Monorepo Hygiene**:
   - Zero nested `.git`, `.gitignore`, or redundant `.npmrc` files inside package subdirectories.

---

## 4. Verification Gates & Mandatory Toolchain

Before declaring any cycle `DONE`, run and verify:

```powershell
pnpm typecheck              # Strict TypeScript verification across packages
pnpm build                  # Build package artifacts
pnpm test                   # Vitest unit test suite
node scripts/check-layer.mjs # Canonical Layer Gate enforcement
```
