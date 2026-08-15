const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/,
  /\b(?:sk|pk|rk|ghp|github_pat|xox[baprs])-?[a-zA-Z0-9_\-]{20,}\b/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*\S+/i,
]

export interface SensitiveContentRules {
  credentials: boolean
  paymentCards: boolean
  identityNumbers: boolean
}

export const defaultSensitiveContentRules: SensitiveContentRules = {
  credentials: true,
  paymentCards: true,
  identityNumbers: true,
}

export function normalizeSensitiveContentRules(value: unknown): SensitiveContentRules {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<SensitiveContentRules> : {}
  return {
    credentials: input.credentials !== false,
    paymentCards: input.paymentCards !== false,
    identityNumbers: input.identityNumbers !== false,
  }
}

export function passesLuhnCheck(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length < 15 || digits.length > 19) return false
  let sum = 0
  let doubleDigit = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (doubleDigit) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    doubleDigit = !doubleDigit
  }
  return sum % 10 === 0
}

export function isValidChineseId(value: string): boolean {
  if (!/^\d{17}[\dXx]$/.test(value)) return false
  const birth = value.slice(6, 14)
  const year = Number(birth.slice(0, 4))
  const month = Number(birth.slice(4, 6))
  const day = Number(birth.slice(6, 8))
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0)
  return checks[sum % 11] === value[17].toUpperCase()
}

export function isSensitiveClipboardContent(text: string, rules: SensitiveContentRules = defaultSensitiveContentRules): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const normalizedRules = normalizeSensitiveContentRules(rules)
  if (normalizedRules.credentials && secretPatterns.some(pattern => pattern.test(trimmed))) return true
  if (normalizedRules.identityNumbers && (trimmed.match(/\b\d{17}[\dXx]\b/g) || []).some(isValidChineseId)) return true
  return normalizedRules.paymentCards && (trimmed.match(/\b(?:\d[ -]?){15,19}\b/g) || []).some(passesLuhnCheck)
}
