import type {
  InstallResult,
  InstallStatus,
  UninstallResult,
  UninstallStatus,
} from './types';

const STATUS_GLYPH: Record<InstallStatus, string> = {
  installed: 'OK',
  'already-installed': 'OK',
  updated: 'OK',
  'needs-user-action': '!',
  blocked: 'X',
  failed: 'X',
};

const STATUS_LABEL: Record<InstallStatus, string> = {
  installed: 'installed',
  'already-installed': 'already installed',
  updated: 'updated',
  'needs-user-action': 'needs user action',
  blocked: 'blocked',
  failed: 'failed',
};

export function formatResult(result: InstallResult): string {
  const lines: string[] = [];
  lines.push(
    `[${STATUS_GLYPH[result.status]}] tab completions for ${result.shell}: ${STATUS_LABEL[result.status]}`
  );
  if (result.explanation) {
    lines.push(`    ${result.explanation}`);
  }
  for (const action of result.actions) {
    const verb = action.performed
      ? action.type === 'write-file'
        ? 'wrote'
        : action.type === 'append-file'
          ? 'appended to'
          : 'created'
      : action.type === 'write-file'
        ? 'would write'
        : action.type === 'append-file'
          ? 'would append to'
          : 'would create';
    lines.push(`    ${verb} ${action.path}`);
  }
  if (result.userInstructions.length > 0) {
    lines.push('');
    lines.push('  Next steps:');
    for (let i = 0; i < result.userInstructions.length; i++) {
      const step = result.userInstructions[i];
      lines.push(`    ${i + 1}. ${step.replace(/\n/g, '\n       ')}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('  Warnings:');
    for (const w of result.warnings) {
      lines.push(`    - ${w}`);
    }
  }
  return lines.join('\n');
}

export function shouldPrint(
  result: InstallResult,
  setting: boolean | 'on-error'
): boolean {
  if (setting === true) return true;
  if (setting === false) return false;
  return (
    result.status === 'needs-user-action' ||
    result.status === 'blocked' ||
    result.status === 'failed' ||
    result.warnings.length > 0
  );
}

const UNINSTALL_GLYPH: Record<UninstallStatus, string> = {
  uninstalled: 'OK',
  'not-installed': 'OK',
  blocked: 'X',
  failed: 'X',
};

const UNINSTALL_LABEL: Record<UninstallStatus, string> = {
  uninstalled: 'uninstalled',
  'not-installed': 'nothing to remove',
  blocked: 'blocked',
  failed: 'failed',
};

export function formatUninstallResult(result: UninstallResult): string {
  const lines: string[] = [];
  lines.push(
    `[${UNINSTALL_GLYPH[result.status]}] tab completions for ${result.shell}: ${UNINSTALL_LABEL[result.status]}`
  );
  if (result.explanation) {
    lines.push(`    ${result.explanation}`);
  }
  for (const action of result.actions) {
    const verb = action.performed
      ? action.type === 'remove-file'
        ? 'removed'
        : 'removed block from'
      : action.type === 'remove-file'
        ? 'would remove'
        : 'would remove block from';
    lines.push(`    ${verb} ${action.path}`);
  }
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('  Warnings:');
    for (const w of result.warnings) {
      lines.push(`    - ${w}`);
    }
  }
  return lines.join('\n');
}

export function shouldPrintUninstall(
  result: UninstallResult,
  setting: boolean | 'on-error'
): boolean {
  if (setting === true) return true;
  if (setting === false) return false;
  return (
    result.status === 'blocked' ||
    result.status === 'failed' ||
    result.warnings.length > 0
  );
}
