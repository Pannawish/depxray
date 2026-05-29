export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function cn(...classes: string[]): string {
  return classes.filter(Boolean).join(' ');
}
