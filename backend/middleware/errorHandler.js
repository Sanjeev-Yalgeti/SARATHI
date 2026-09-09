/**
 * Centralized error-handling middleware.
 * Always mount these LAST in index.js.
 */

/**
 * 404 handler — triggered when no route matches.
 */
export function notFound(req, res, next) {
  const err = new Error(`Not Found — ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

/**
 * Global error handler.
 * Normalises upstream API errors, validation errors, and unexpected exceptions
 * into a consistent JSON shape.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;

  // Surface upstream API error details when available
  const message =
    err.response?.data?.error_message || // Google / HERE style
    err.message ||
    "Internal Server Error";

  console.error(`[${new Date().toISOString()}] ${statusCode} — ${message}`);
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
}
