/**
 * Parse a naive local wall-clock timestamp (no timezone conversion) — strips a
 * trailing 'Z' if present so `new Date(...)` treats the string as local time
 * instead of UTC. See CLAUDE.md's datetime convention note.
 */
export function parseLocal(iso: string): Date {
  return new Date(iso.replace('Z', ''))
}
