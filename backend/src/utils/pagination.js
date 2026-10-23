function getPagination(query) {
  const page = Number(query.page || 1);
  const limit = Math.min(Number(query.limit || 20), 100);

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

module.exports = { getPagination };
