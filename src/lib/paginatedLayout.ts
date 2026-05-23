export function clampPageIndex(page: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.max(0, Math.min(page, totalPages - 1));
}

export function toChapterFraction(page: number, totalPages: number): number {
  if (totalPages <= 1) return 0;
  return clampPageIndex(page, totalPages) / (totalPages - 1);
}

export function pageIndexFromFraction(position: number, totalPages: number): number {
  if (totalPages <= 1) return 0;
  const clamped = Math.max(0, Math.min(position, 1));
  return clampPageIndex(Math.round(clamped * (totalPages - 1)), totalPages);
}
