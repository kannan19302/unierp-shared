---
name: config-governance-standards
description: Authoritative standards, architectural boundaries, coding anatomy, and verification gates for config.
version: 1.0.0
author: UniERP Architecture Governance
---

# UniERP Configuration & Secrets Platform — AI Agent Guidance & Project Skill

This skill governs all code modification, analysis, and testing within `config` (**Layer L1: Foundation**). Every AI agent and software engineer working in this repository MUST follow these rules without exception.

---

## 🏛️ 1. Architectural Position & Boundary Rules

- **Repository**: `config`
- **Layer**: **L1 (Foundation)**
- **Package Identity**: `@kannan19302/config`
- **Allowed Inbound Callers**: L2-L7
- **Allowed Outbound Dependencies**: @kannan19302/contracts (L0)
- **STRICTLY FORBIDDEN DEPENDENCIES**:
  - ❌ Layers L2-L7
  - ❌ Direct business runtime logic

> **Unidirectional Rule**: You may ONLY import published artifacts from strictly lower layers. Sibling imports within the same layer are prohibited unless mediated through L0 contracts.

---

## 🎯 2. The Platform Goal & Repository Mandate

> **Platform North Star Goal**:  
> "Build the world's premier autonomous, multi-tenant Enterprise SaaS Operating System: 100% Zero-Trust Multi-Tenant Isolation, Absolute Decimal(19,4) Numeric Precision, Atomic Durable Audit Logging, Sub-100ms P99 Latency, and Strata Workbench High-Density UI."

### Repository Responsibility Mandate
Environment configuration validation, schema parsing, and KMS/Vault secret resolution adapters.

---

## 📐 3. Repository-Specific Coding Standards

### Core Implementation Standards
1. Maintain strict modular boundaries and single-responsibility interfaces.
2. Export all public types from the root `index.ts`.
3. Ensure zero TypeScript compilation errors under `tsc --noEmit`.

---

## 🛡️ 4. Mandatory Pre-Commit Verification Gate

Before submitting or reporting completion on any change in this repository, run and verify:

```bash
pnpm test && pnpm typecheck
```

All tests must pass with 0 failures and 0 type errors.
