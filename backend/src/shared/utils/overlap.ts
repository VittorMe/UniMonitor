export const intervalsOverlap = (startA: Date, endA: Date, startB: Date, endB: Date): boolean =>
  startA < endB && endA > startB;

export const assertValidInterval = (startAt: Date, endAt: Date): void => {
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) {
    throw new Error('Data de inicio invalida');
  }
  if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) {
    throw new Error('Data de fim invalida');
  }
};
