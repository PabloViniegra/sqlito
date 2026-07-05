import { COMMAND_DESCRIPTORS } from "./commandRegistry.ts";

const NAME_COLUMN_WIDTH = 21;

function formatCommandLine(name: string, description: string): string {
  return `  ${name}`.padEnd(NAME_COLUMN_WIDTH) + description;
}

export const HELP_TEXT = [
  "Commands:",
  ...Object.values(COMMAND_DESCRIPTORS).map((descriptor) =>
    formatCommandLine(descriptor.name, descriptor.description),
  ),
].join("\n");
