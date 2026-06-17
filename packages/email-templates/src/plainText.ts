export function plainTextEmail(title: string, lines: string[]): string {
  return [title, "", ...lines.filter(Boolean), "", "— ServeOS"].join("\n");
}
