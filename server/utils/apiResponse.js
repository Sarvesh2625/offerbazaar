/**
 * Standardized API Response Helpers
 */
export class ApiResponse {
  static success(res, message = 'Success', data = null, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(
    res,
    message = 'Internal Server Error',
    error = null,
    statusCode = 500
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: error ? error.message || error : null,
    });
  }
}
