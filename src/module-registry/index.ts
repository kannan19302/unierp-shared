export type {
  AppModuleDescriptor,
  ModuleNavContext,
  NavItem,
} from "./types";
export {
  registerModule,
  getModuleDescriptor,
  getAllModuleDescriptors,
  resolveNav,
  __resetModuleRegistryForTests,
} from "./registry";
