import type { Rule } from "../types.js";
import { executionRules } from "./execution.js";
import { exfiltrationRules } from "./exfiltration.js";
import { injectionRules } from "./injection.js";
import { networkRules } from "./network.js";
import { permissionRules } from "./permissions.js";
import { secretRules } from "./secrets.js";
import { structureRules } from "./structure.js";
import { unicodeRules } from "./unicode.js";

export const allRules: Rule[] = [
  ...structureRules,
  ...permissionRules,
  ...injectionRules,
  ...exfiltrationRules,
  ...executionRules,
  ...networkRules,
  ...secretRules,
  ...unicodeRules,
];
export { parseAllowedTools } from "./permissions.js";
