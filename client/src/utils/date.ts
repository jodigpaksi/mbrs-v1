/**
 * Parse a naive local wall-clock timestamp (no timezone conversion) — strips a
 * trailing 'Z' if present so `new Date(...)` treats the string as local time
 * instead of UTC. See CLAUDE.md's datetime convention note.
 */
export function parseLocal(iso: string): Date {
  return new Date(iso.replace('Z', ''))
}

/** "HH:mm" -> minutes since midnight. */
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutes since midnight -> "HH:mm". */
export function fromMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
