export const capitalize = (s: string) =>
  s.replace(/^\w/, (c) => c.toUpperCase());

export const quote = (s: string) =>
  s.match(/\s/) ? `"${s.replace('"', '\\"')}"` : s;
