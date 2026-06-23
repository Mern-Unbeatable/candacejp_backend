export function buildPagination(page, limit, total) {
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, parseInt(limit, 10) || 10);
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);

  return {
    page: currentPage,
    limit: perPage,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}
