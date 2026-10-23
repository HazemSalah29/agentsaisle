import { CliError } from "./errors.js";
import { createProgram } from "./program.js";

try {
  await createProgram().parseAsync(process.argv);
} catch (e) {
  if (e instanceof CliError) {
    console.error(`Error: ${e.message}`);
    process.exit(e.exitCode);
  }
  throw e;
}
