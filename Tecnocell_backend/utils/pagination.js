function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePagination(query = {}, options = {}) {
  const defaultPage = options.defaultPage || 1;
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;

  const page = toPositiveInt(query.page, defaultPage);
  const rawLimit = toPositiveInt(query.limit, defaultLimit);
  const limit = Math.min(rawLimit, maxLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function parseLimit(value, options = {}) {
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;

  const rawLimit = toPositiveInt(value, defaultLimit);
  return Math.min(rawLimit, maxLimit);
}

module.exports = {
  parsePagination,
  parseLimit,
};
