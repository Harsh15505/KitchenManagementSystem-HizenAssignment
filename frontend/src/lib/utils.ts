export { cn } from 'cn';

/** A count with the right word: `plural(1, 'box', 'boxes')` → "1 box", `plural(3, 'meal')` → "3 meals". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
