export const capitalize = (s: string) =>
  s.replace(/^-?\w/, (c) => c.toUpperCase());

export const toggleSingularPlural = (s: string) =>
  s.endsWith("s") ? s.slice(0, -1) : s + "s";
