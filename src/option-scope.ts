import type { RootCommand } from './t';

export type OptionLookupMode = 'parent-first' | 'local';

const optionLookupModes = new WeakMap<RootCommand, OptionLookupMode>();

export function setOptionLookupMode(
  command: RootCommand,
  mode: OptionLookupMode
): void {
  optionLookupModes.set(command, mode);
}

export function getOptionLookupMode(
  command: RootCommand
): OptionLookupMode | undefined {
  return optionLookupModes.get(command);
}
