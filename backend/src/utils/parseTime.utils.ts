export const parseTimeToMs = (value: string): number => {
  const match = value.match(/^(\d+)(s|m|h|d)$/);

  if (!match) {
    throw new Error(`Invalid time format: ${value}`);
  }

  const [, num, unit] = match;
  const n = Number(num);

  const map = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return n * map[unit as keyof typeof map];
};
