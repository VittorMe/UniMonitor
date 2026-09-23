const unitToMs = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type Unit = keyof typeof unitToMs;

/**
 * Converte duracoes no formato aceito pelo jsonwebtoken ("15m", "7d", "3600s")
 * em milissegundos, para reaproveitar o mesmo valor no `maxAge` do cookie.
 * Numero sem sufixo e interpretado como segundos, igual ao jsonwebtoken.
 */
export const durationToMs = (value: string): number => {
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(value.trim());

  if (!match?.[1]) {
    throw new Error(`Duracao invalida: "${value}"`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's') as Unit;

  return amount * unitToMs[unit];
};
