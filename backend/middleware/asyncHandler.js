/**
 * Async wrapper — removes the need for try/catch in every route handler.
 * Usage:  router.get("/path", asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
