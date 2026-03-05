import type { BundleConfig } from "./types";
import { generateId, validateConfig as validateSharedConfig } from "../../../../shared/bundle-domain";

export { generateId };

export function validateConfig(config: BundleConfig, currentProductId: string): string[] {
  return validateSharedConfig(config, currentProductId).errors;
}
