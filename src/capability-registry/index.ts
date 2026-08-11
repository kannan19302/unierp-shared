export type {
  CapabilityContract,
  CapabilityStatus,
  CredentialField,
  ResourceKind,
} from "./types";
export {
  registerCapability,
  unregisterCapability,
  getCapability,
  getAllCapabilities,
  bindProvider,
  unbindProvider,
  resolve,
  __resetCapabilityRegistryForTests,
} from "./registry";
import "./catalogue";
