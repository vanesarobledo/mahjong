export function shuffle<T>(arr: T[]) {
  // Fisher-Yates Shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // i and j are always in-bounds
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}
