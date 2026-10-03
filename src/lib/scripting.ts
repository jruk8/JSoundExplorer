// JMHScript snippet domain. Pure string formatting; no React dependency.

export type JmhCommand = 'psound' | 'rsound' | 'gsound'

export const JMH_COMMANDS: JmhCommand[] = ['psound', 'rsound', 'gsound']

/** Role inserted into rsound snippets. */
export const RSOUND_ROLE = 'HUNTER'

const COMMAND_PREFIX: Record<JmhCommand, string> = {
  psound: '<psound:<p>,',
  rsound: `<rsound:${RSOUND_ROLE},`,
  gsound: '<gsound:',
}

/**
 * Format a sound as a JMHScript snippet. psound targets one player, rsound
 * targets a role, gsound targets every participant (no target segment).
 * Default pitch (1.0) and volume (100%) are omitted with their preceding
 * separators; a default pitch is still written when a non-default volume
 * follows it. Volume is written in the 0.0-1.0 gain range.
 */
export function formatJmh(
  key: string,
  pitch: number,
  volumePercent: number,
  command: JmhCommand = 'psound',
): string {
  const pitchDefault = pitch === 1
  const volumeDefault = volumePercent === 100
  let text = `${COMMAND_PREFIX[command]}${key}`
  if (!pitchDefault || !volumeDefault) text += `,${pitch.toFixed(1)}`
  if (!volumeDefault) text += `,${(volumePercent / 100).toFixed(1)}`
  return `${text}>`
}
