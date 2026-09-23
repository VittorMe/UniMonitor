export interface AcademicPeriod {
  year: number;
  semester: 1 | 2;
}

/**
 * Janeiro–junho = semestre 1; julho–dezembro = semestre 2.
 * Ex.: setembro/2026 → 2026.2
 */
export const currentAcademicPeriod = (date = new Date()): AcademicPeriod => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return { year, semester: month <= 6 ? 1 : 2 };
};

export const periodLabel = (period: AcademicPeriod): string =>
  `${period.year}.${period.semester}`;

export const parsePeriod = (year?: number, semester?: number): AcademicPeriod => {
  const current = currentAcademicPeriod();
  const resolvedSemester = semester === 1 || semester === 2 ? semester : current.semester;
  return { year: year ?? current.year, semester: resolvedSemester };
};
