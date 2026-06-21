import type { PaginationQuery, PaginationResult } from '../types/pagination.types.js';

export const getPaginationParams = (
  query: PaginationQuery,
): PaginationResult => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};
export const buildPaginationMeta = ({
  totalItems,
  page,
  limit,
  itemCount,
}: {
  totalItems: number;
  page: number;
  limit: number;
  itemCount: number;
}) => ({
  totalItems,
  itemCount,
  itemsPerPage: limit,
  totalPages: Math.ceil(totalItems / limit),
  currentPage: page,
});
