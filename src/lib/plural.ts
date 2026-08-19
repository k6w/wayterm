/** "1 row" / "2 rows". Pass `many` for irregular plurals ("entry" / "entries"). */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
