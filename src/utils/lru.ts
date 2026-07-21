export class WeightedLruCache<T> {
  private readonly values = new Map<string, { value: T; weight: number }>()
  private totalWeight = 0

  constructor(private readonly maxEntries: number, private readonly maxWeight: number) {}

  get(key: string): T | undefined {
    const entry = this.values.get(key)
    if (!entry) return undefined
    this.values.delete(key)
    this.values.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, weight: number): void {
    const safeWeight = Math.max(0, Math.floor(weight))
    const existing = this.values.get(key)
    if (existing) {
      this.totalWeight -= existing.weight
      this.values.delete(key)
    }
    if (safeWeight > this.maxWeight) return
    this.values.set(key, { value, weight: safeWeight })
    this.totalWeight += safeWeight
    while (this.values.size > this.maxEntries || this.totalWeight > this.maxWeight) {
      const oldestKey = this.values.keys().next().value as string | undefined
      if (!oldestKey) break
      const oldest = this.values.get(oldestKey)
      this.values.delete(oldestKey)
      this.totalWeight -= oldest?.weight || 0
    }
  }

  delete(key: string): void {
    const entry = this.values.get(key)
    if (!entry) return
    this.totalWeight -= entry.weight
    this.values.delete(key)
  }
}
