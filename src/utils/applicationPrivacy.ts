export const MAX_BLOCKED_APPLICATIONS = 40
export const MAX_APPLICATION_RULE_LENGTH = 120

function normalizeApplicationName(value: string): string {
  return value.trim().split(/[\\/]/).pop()?.toLowerCase().replace(/\.exe$/i, '').replace(/\s+/g, ' ').slice(0, MAX_APPLICATION_RULE_LENGTH) || ''
}

export function normalizeBlockedApplications(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const applications: string[] = []
  for (const value of input) {
    if (typeof value !== 'string') continue
    const normalized = normalizeApplicationName(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    applications.push(normalized)
    if (applications.length >= MAX_BLOCKED_APPLICATIONS) break
  }
  return applications
}

export function matchesBlockedApplication(rules: unknown, application: unknown): boolean {
  if (typeof application !== 'string') return false
  const normalizedApplication = normalizeApplicationName(application)
  if (!normalizedApplication) return false
  return normalizeBlockedApplications(rules).some(rule => normalizedApplication === rule)
}
