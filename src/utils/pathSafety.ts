export function isResolvedPathInside(root: string, candidate: string, separator: string, caseInsensitive = false): boolean {
  const normalize = (value: string) => caseInsensitive ? value.toLowerCase() : value
  const normalizedRoot = normalize(root.endsWith(separator) ? root : `${root}${separator}`)
  const normalizedCandidate = normalize(candidate)
  return normalizedCandidate.startsWith(normalizedRoot) && normalizedCandidate.length > normalizedRoot.length
}
