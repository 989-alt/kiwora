/** The ruler reading the student must pick: the plant's height to the nearest cm, at least 1. */
export function measureAnswer(heightCm: number): number {
  return Math.max(1, Math.round(heightCm))
}
