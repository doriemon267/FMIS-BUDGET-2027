const Joi = require('joi');

/**
 * Express middleware: validate req.body, req.query, or req.params with a Joi schema.
 * On success: replaces the target with the validated value (type coercion applied) and calls next().
 * On error: responds with 400 and { error: "Validation failed", details: [...] }.
 *
 * @param {Joi.ObjectSchema} schema - Joi schema (e.g. Joi.object({ username: Joi.string().required() }))
 * @param {Object} options - { source: 'body' | 'query' | 'params', stripUnknown: true }
 */
function validateJoi(schema, options = {}) {
  const source = options.source || 'body';
  const stripUnknown = options.stripUnknown !== false;

  return (req, res, next) => {
    const value = req[source];
    const result = schema.validate(value, {
      stripUnknown: stripUnknown === true,
      abortEarly: false,
    });

    if (result.error) {
      const details = result.error.details.map((d) => ({
        path: d.path.join('.'),
        message: d.message,
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }

    req[source] = result.value;
    next();
  };
}

module.exports = { validateJoi, Joi };
