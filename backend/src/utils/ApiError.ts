export class ApiError extends Error {
  statusCode: number;
  data: null;
  success: boolean;
  error: unknown[];

  constructor(
    statuscode: number,
    message = 'something went wrong',
    error: unknown[] = [],
    stack = ''
  ) {
    super(message);
    this.statusCode = statuscode;
    this.data = null;
    this.success = false;
    this.message = message;
    this.error = error;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
