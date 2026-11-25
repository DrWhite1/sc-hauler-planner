// Star Citizen standard cargo containers (SCU).
// 1 SCU = 1.25 x 1.25 x 1.25 m external.
// Containers snap to the cargo grid in these sizes only.

export const STANDARD_CONTAINERS = [1, 2, 4, 8, 16, 32] as const;
export type ContainerSize = (typeof STANDARD_CONTAINERS)[number];

export function nearestContainer(scu: number): ContainerSize {
  const sizes = STANDARD_CONTAINERS;
  for (const s of sizes) {
    if (scu <= s) return s;
  }
  return 32;
}

export function splitIntoContainers(totalScu: number, maxSize: number): number[] {
  const allowed = STANDARD_CONTAINERS.filter((s) => s <= maxSize);
  const result: number[] = [];
  let remaining = totalScu;
  const largest = allowed[allowed.length - 1] || 1;
  while (remaining >= largest) {
    result.push(largest);
    remaining -= largest;
  }
  if (remaining > 0) {
    const fit = allowed.filter((s) => s >= remaining).sort((a, b) => a - b)[0] || remaining;
    result.push(fit);
  }
  return result;
}