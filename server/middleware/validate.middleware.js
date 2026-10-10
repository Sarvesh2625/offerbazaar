/**
 * Generic request body validation middleware using Zod schemas
 * @param {import('zod').ZodSchema} schema - Zod schema to validate req.body against
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issues = result.error.issues || result.error.errors || [];
      const errorMessages = issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        message: errorMessages[0]?.message || 'Validation failed',
        errors: errorMessages,
      });
    }

    req.body = result.data;
    next();
  };
};
