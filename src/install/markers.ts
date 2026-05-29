/**
 * Idempotency markers. Every file/block we write starts with a marker line so
 * we can safely detect on re-run whether the existing content is ours.
 */

import { existsSync, readFileSync } from 'node:fs';

export type MarkerKind = 'file' | 'block';
export type CommentSyntax = '#' | '//' | '<#';

export type MarkerInfo = {
  managedByTab: boolean;
  name?: string;
  version?: string;
};

export function makeFileMarker(
  name: string,
  version: string,
  comment: CommentSyntax = '#'
): string {
  return `${comment} tab-completion managed-by=tab name=${name} version=${version}`;
}

export function makeBlockStart(name: string, comment: CommentSyntax = '#'): string {
  return `${comment} >>> tab:${name} >>>`;
}

export function makeBlockEnd(name: string, comment: CommentSyntax = '#'): string {
  return `${comment} <<< tab:${name} <<<`;
}

/** Inspect existing file for our marker (any version). */
export function inspectFile(path: string): MarkerInfo {
  if (!existsSync(path)) return { managedByTab: false };
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    return { managedByTab: false };
  }
  const match = content.match(
    /(?:^|\n)[^\n]*tab-completion managed-by=tab name=(\S+) version=(\S+)/
  );
  if (!match) return { managedByTab: false };
  return { managedByTab: true, name: match[1], version: match[2] };
}

/**
 * Wrap a multi-line block in start/end sentinels for idempotent append to
 * shellrc/profile files.
 */
export function wrapBlock(
  name: string,
  body: string,
  comment: CommentSyntax = '#'
): string {
  return `${makeBlockStart(name, comment)}\n${body.trim()}\n${makeBlockEnd(name, comment)}\n`;
}

/** True if `content` contains an unmodified wrapped block for this name. */
export function fileContainsBlock(
  filePath: string,
  name: string,
  comment: CommentSyntax = '#'
): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const content = readFileSync(filePath, 'utf-8');
    return (
      content.includes(makeBlockStart(name, comment)) &&
      content.includes(makeBlockEnd(name, comment))
    );
  } catch {
    return false;
  }
}

/**
 * Remove the wrapped block from `content`. Returns the original content if no
 * block is present.
 */
export function removeBlock(
  content: string,
  name: string,
  comment: CommentSyntax = '#'
): string {
  const start = makeBlockStart(name, comment);
  const end = makeBlockEnd(name, comment);
  const startIdx = content.indexOf(start);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(end, startIdx);
  if (endIdx === -1) return content;
  const before = content.slice(0, startIdx).replace(/\n+$/, '');
  const after = content.slice(endIdx + end.length).replace(/^\n+/, '');
  return [before, after].filter((s) => s.length > 0).join('\n') + (after ? '\n' : '');
}

/**
 * Replace the existing wrapped block (if present) with `newBlock`, otherwise
 * return `content + '\n' + newBlock`.
 */
export function upsertBlock(
  content: string,
  name: string,
  newBlock: string,
  comment: CommentSyntax = '#'
): string {
  const start = makeBlockStart(name, comment);
  const end = makeBlockEnd(name, comment);
  const startIdx = content.indexOf(start);
  if (startIdx === -1) {
    const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    return content + sep + newBlock;
  }
  const endIdx = content.indexOf(end, startIdx);
  if (endIdx === -1) {
    return content + '\n' + newBlock;
  }
  return (
    content.slice(0, startIdx) +
    newBlock.trimEnd() +
    '\n' +
    content.slice(endIdx + end.length).replace(/^\n/, '')
  );
}
