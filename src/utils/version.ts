interface ParsedVersion {
  numbers: number[]
  prerelease: string[]
}

function parseVersion(input: string): ParsedVersion {
  const normalized = input.trim().replace(/^v/i, '').split('+', 1)[0]
  const [main = '0', prerelease = ''] = normalized.split('-', 2)
  return {
    numbers: main.split('.').map(part => Number.parseInt(part, 10) || 0),
    prerelease: prerelease ? prerelease.split('.') : [],
  }
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  const length = Math.max(a.numbers.length, b.numbers.length)

  for (let index = 0; index < length; index += 1) {
    const difference = (a.numbers[index] || 0) - (b.numbers[index] || 0)
    if (difference !== 0) return difference > 0 ? 1 : -1
  }

  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1
  if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1

  const prereleaseLength = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < prereleaseLength; index += 1) {
    const leftPart = a.prerelease[index]
    const rightPart = b.prerelease[index]
    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null
    if (leftNumber !== null && rightNumber !== null) return leftNumber > rightNumber ? 1 : -1
    if (leftNumber !== null) return -1
    if (rightNumber !== null) return 1
    return leftPart.localeCompare(rightPart) > 0 ? 1 : -1
  }
  return 0
}
