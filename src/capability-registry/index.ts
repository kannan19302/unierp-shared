export type {
  CapabilityContract,
  CapabilityStatus,
  CredentialField,
  ResourceKind,
} from "./types.js";
export {
  registerCapability,
  unregisterCapability,
  getCapability,
  getAllCapabilities,
  bindProvider,
  unbindProvider,
  resolve,
  __resetCapabilityRegistryForTests,
} from "./registry.js";
import "./catalogue.js";
