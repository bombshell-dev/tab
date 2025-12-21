import { describe, it, expect } from 'vitest';
import * as fish from '../src/fish';
import * as bash from '../src/bash';
import * as zsh from '../src/zsh';
import * as powershell from '../src/powershell';
import { ShellCompDirective } from '../src/t';

describe('shell completion generators', () => {
  const name = 'testcli';
  const exec = '/usr/bin/node /path/to/testcli';
  const specialName = 'test-cli:app';
  const escapedName = specialName.replace(/[-:]/g, '_');

  describe('fish shell completion', () => {
    it('should generate a valid fish completion script', () => {
      const script = fish.generate(name, exec);

      // Use snapshot testing instead of individual assertions
      expect(script).toMatchSnapshot();
    });

    it('should handle special characters in the name', () => {
      const script = fish.generate(specialName, exec);

      // Use snapshot testing instead of individual assertions
      expect(script).toMatchSnapshot();
    });
  });

  describe('bash shell completion', () => {
    it('should generate a valid bash completion script', () => {
      const script = bash.generate(name, exec);

      // Check that the script contains the shell name
      expect(script).toContain(`# bash completion for ${name}`);

      // Check that the script defines the directives
      expect(script).toContain(
        `readonly ShellCompDirectiveError=${ShellCompDirective.ShellCompDirectiveError}`
      );
      expect(script).toContain(
        `readonly ShellCompDirectiveNoSpace=${ShellCompDirective.ShellCompDirectiveNoSpace}`
      );
      expect(script).toContain(
        `readonly ShellCompDirectiveNoFileComp=${ShellCompDirective.ShellCompDirectiveNoFileComp}`
      );
      expect(script).toContain(
        `readonly ShellCompDirectiveFilterFileExt=${ShellCompDirective.ShellCompDirectiveFilterFileExt}`
      );
      expect(script).toContain(
        `readonly ShellCompDirectiveFilterDirs=${ShellCompDirective.ShellCompDirectiveFilterDirs}`
      );
      expect(script).toContain(
        `readonly ShellCompDirectiveKeepOrder=${ShellCompDirective.ShellCompDirectiveKeepOrder}`
      );

      // Check that the script contains the debug function
      expect(script).toContain(`__${name}_debug()`);

      // Check that the script contains the completion function
      expect(script).toContain(`__${name}_complete()`);

      // Check that the script contains the completion registration
      expect(script).toContain(`complete -F __${name}_complete ${name}`);

      // Check that the script uses the provided exec path
      expect(script).toContain(`requestComp="${exec} complete --`);

      // Check that the script handles directives correctly
      expect(script).toContain(
        `if [[ $((directive & $ShellCompDirectiveError)) -ne 0 ]]`
      );
      expect(script).toContain(
        `if [[ $((directive & $ShellCompDirectiveNoSpace)) -ne 0 ]]`
      );
      expect(script).toContain(
        `if [[ $((directive & $ShellCompDirectiveKeepOrder)) -ne 0 ]]`
      );
      expect(script).toContain(
        `if [[ $((directive & $ShellCompDirectiveNoFileComp)) -ne 0 ]]`
      );
      expect(script).toContain(
        `if [[ $((directive & $ShellCompDirectiveFilterFileExt)) -ne 0 ]]`
      );
      expect(script).toContain(
        `if [[ $((directive & $ShellCompDirectiveFilterDirs)) -ne 0 ]]`
      );
    });

    it('should handle special characters in the name', () => {
      const script = bash.generate(specialName, exec);

      // Check that the script properly escapes the name
      expect(script).toContain(`__${escapedName}_debug()`);
      expect(script).toContain(`__${escapedName}_complete()`);
      expect(script).toContain(
        `complete -F __${escapedName}_complete ${specialName}`
      );
    });
  });

  describe('zsh shell completion', () => {
    it('should generate a valid zsh completion script', () => {
      const script = zsh.generate(name, exec);

      // Check that the script contains the shell name
      expect(script).toContain(`#compdef ${name}`);
      expect(script).toContain(`compdef _${name} ${name}`);

      // Check that the script contains the debug function
      expect(script).toContain(`__${name}_debug()`);

      // Check that the script contains the completion function
      expect(script).toContain(`_${name}()`);

      // Check that the script uses the provided exec path
      expect(script).toContain(`requestComp="${exec} complete --`);

      // Check that the script handles directives
      expect(script).toContain(
        `shellCompDirectiveError=${ShellCompDirective.ShellCompDirectiveError}`
      );
      expect(script).toContain(
        `shellCompDirectiveNoSpace=${ShellCompDirective.ShellCompDirectiveNoSpace}`
      );
      expect(script).toContain(
        `shellCompDirectiveNoFileComp=${ShellCompDirective.ShellCompDirectiveNoFileComp}`
      );
      expect(script).toContain(
        `shellCompDirectiveFilterFileExt=${ShellCompDirective.ShellCompDirectiveFilterFileExt}`
      );
      expect(script).toContain(
        `shellCompDirectiveFilterDirs=${ShellCompDirective.ShellCompDirectiveFilterDirs}`
      );
      expect(script).toContain(
        `shellCompDirectiveKeepOrder=${ShellCompDirective.ShellCompDirectiveKeepOrder}`
      );
    });

    it('should handle special characters in the name', () => {
      const script = zsh.generate(specialName, exec);

      // Check that the script properly escapes the name
      expect(script).toContain(`#compdef ${specialName}`);
      // In zsh, special characters are not escaped in the function name
      expect(script).toContain(`__${specialName}_debug()`);
      expect(script).toContain(`_${specialName}()`);
    });
  });

  describe('powershell completion', () => {
    it('should generate a valid powershell completion script', () => {
      const script = powershell.generate(name, exec);

      // Check that the script contains the shell name
      expect(script).toContain(`# powershell completion for ${name}`);

      // Check that the script contains the debug function
      expect(script).toContain(`function __${name}_debug`);

      // Check that the script contains the completion block
      expect(script).toContain(`[scriptblock]$__${name}CompleterBlock =`);

      // Check that the script uses the provided exec path
      expect(script).toContain(
        `$RequestComp = "& ${exec} complete '--' $QuotedArgs"`
      );

      // Check that the script handles directives
      expect(script).toContain(
        `$ShellCompDirectiveError=${ShellCompDirective.ShellCompDirectiveError}`
      );
      expect(script).toContain(
        `$ShellCompDirectiveNoSpace=${ShellCompDirective.ShellCompDirectiveNoSpace}`
      );
      expect(script).toContain(
        `$ShellCompDirectiveNoFileComp=${ShellCompDirective.ShellCompDirectiveNoFileComp}`
      );
      expect(script).toContain(
        `$ShellCompDirectiveFilterFileExt=${ShellCompDirective.ShellCompDirectiveFilterFileExt}`
      );
      expect(script).toContain(
        `$ShellCompDirectiveFilterDirs=${ShellCompDirective.ShellCompDirectiveFilterDirs}`
      );
      expect(script).toContain(
        `$ShellCompDirectiveKeepOrder=${ShellCompDirective.ShellCompDirectiveKeepOrder}`
      );
    });

    it('should handle special characters in the name', () => {
      const script = powershell.generate(specialName, exec);

      // Check that the script properly escapes the name
      // In PowerShell, special characters are not escaped in the function name
      expect(script).toContain(`function __${specialName}_debug`);
      // The CompleterBlock name uses underscores instead of colons
      expect(script).toContain(`$__test_cli_appCompleterBlock`);
    });
  });
});
