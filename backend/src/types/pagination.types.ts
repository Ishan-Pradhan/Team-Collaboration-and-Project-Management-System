export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
}

export interface PaginationResult {
  page: number;
  limit: number;
  offset: number;
}
