/**
 * M02 — the platform's actual capability catalogue.
 *
 * Every entry below names a capability the platform genuinely exercises
 * today through a single, hard-coded implementation elsewhere in the
 * codebase (e.g. `email.send` via `unierp-api/src/modules/notifications`,
 * A21's notification engine). Registering the CONTRACT here does not bind
 * that existing implementation as a provider through this abstraction — no
 * provider is bound to anything below, honestly, because M03 (the provider
 * registry with real credentials/health/discovery) does not exist yet.
 * `resolve()` on every one of these therefore returns UNSATISFIED today.
 * That is the correct, observable state of a real gap, not a placeholder.
 *
 * Importing this module registers its contents as a side effect, exactly as
 * `navigation.ts` (M01, unierp-console) registers its apps.
 */
import { registerCapability } from "./registry.js";

registerCapability({
  id: "email.send",
  description:
    "Send a transactional or notification email to a recipient. Exercised today by a single hard-coded implementation (unierp-api/src/modules/notifications).",
  owner: "notifications",
  input: [
    { name: "to", description: "Recipient email address", required: true },
    { name: "subject", description: "Message subject", required: true },
    { name: "body", description: "Message body (HTML or text)", required: true },
    { name: "templateId", description: "Optional pre-registered template id", required: false },
  ],
  output: [
    { name: "messageId", description: "Provider-assigned message identifier" },
    { name: "status", description: "queued | sent | failed" },
  ],
  requiredCredentials: [
    { name: "apiKey", description: "Provider API key", secret: true },
    { name: "senderDomain", description: "Verified sending domain", secret: false },
  ],
});

registerCapability({
  id: "object.store",
  description:
    "Store, retrieve and delete a binary object. Exercised today by a single hard-coded implementation (unierp-api/src/modules/storage).",
  owner: "storage",
  input: [
    { name: "key", description: "Object key/path within the bucket", required: true },
    { name: "content", description: "Object bytes or a stream", required: true },
    { name: "contentType", description: "MIME type", required: false },
  ],
  output: [
    { name: "url", description: "Retrieval URL, signed or public per bucket policy" },
    { name: "etag", description: "Content hash for integrity verification" },
  ],
  requiredCredentials: [
    { name: "accessKeyId", description: "Provider access key id", secret: true },
    { name: "secretAccessKey", description: "Provider secret key", secret: true },
    { name: "bucket", description: "Target bucket or container name", secret: false },
  ],
  resourceKinds: ["object-store-bucket"],
});

registerCapability({
  id: "dns.manage",
  description:
    "Create, update and delete DNS records for a tenant's custom domain. Exercised today by a single hard-coded implementation (unierp-api/src/platform/v1/white-label.controller.ts).",
  owner: "platform-infrastructure",
  input: [
    { name: "zone", description: "DNS zone (domain) to operate on", required: true },
    { name: "recordType", description: "A | AAAA | CNAME | TXT | MX", required: true },
    { name: "name", description: "Record name within the zone", required: true },
    { name: "value", description: "Record value", required: true },
  ],
  output: [
    { name: "recordId", description: "Provider-assigned record identifier" },
    { name: "propagationEtaSeconds", description: "Estimated propagation time" },
  ],
  requiredCredentials: [
    { name: "apiToken", description: "Provider API token scoped to the zone", secret: true },
  ],
  resourceKinds: ["dns-zone", "dns-record"],
});

registerCapability({
  id: "llm.complete",
  description:
    "Request a completion from a large language model. Exercised today by a single hard-coded implementation (unierp-api/src/modules/ai).",
  owner: "ai-platform",
  input: [
    { name: "prompt", description: "The input prompt or message history", required: true },
    { name: "model", description: "Model identifier to route to", required: false },
    { name: "maxTokens", description: "Output token ceiling", required: false },
  ],
  output: [
    { name: "completion", description: "The model's response text" },
    { name: "tokensUsed", description: "Input + output tokens consumed, for cost allocation (M27)" },
  ],
  requiredCredentials: [
    { name: "apiKey", description: "Provider API key", secret: true },
  ],
});
