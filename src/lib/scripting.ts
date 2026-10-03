// JMHScript snippet domain. Pure string formatting; no React dependency.

/**
 * Format a sound as a JMHScript snippet. Default pitch (1.0) and volume
 * (100%) are omitted with their preceding separators; a default pitch is
 * still written when a non-default volume follows it. Volume is written
 * in the 0.0-1.0 gain range.
 */
export function formatJmh(key: string, pitch: number, volumePercent: number): string {
  const pitchDefault = pitch === 1
  const volumeDefault = volumePercent === 100
  let text = `<psound:<p>,${key}`
  if (!pitchDefault || !volumeDefault) text += `,${pitch.toFixed(1)}`
  if (!volumeDefault) text += `,${(volumePercent / 100).toFixed(1)}`
  return `${text}>`
}
