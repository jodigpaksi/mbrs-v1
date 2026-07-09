/** Extract a human-readable message from an axios error, falling back to a default. */
export function getErrorMessage(e: unknown, fallback: string): string {
  const resp = (e as { response?: { data?: { message?: string } } })?.response?.data
  return resp?.message ?? fallback
}

/** Same as getErrorMessage, but checks a Laravel validation `errors.<field>[0]` first. */
export function getFieldErrorMessage(e: unknown, field: string, fallback: string): string {
  const resp = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
  return resp?.errors?.[field]?.[0] ?? resp?.message ?? fallback
}
