export interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export const toPaginated = <T>(data: T[], page: number, perPage: number, total: number): Paginated<T> => ({
  data,
  meta: {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  },
});
