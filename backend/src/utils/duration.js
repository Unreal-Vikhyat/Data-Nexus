const durationPattern = /^(\d+)(s|m|h|d)$/;

export function durationMilliseconds(value) {
  const match = durationPattern.exec(value);
  if (!match) throw new Error("JWT_EXPIRES_IN must use a duration such as 15m, 1h, or 7d");
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * units[match[2]];
}
