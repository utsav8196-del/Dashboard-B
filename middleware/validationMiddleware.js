const { validationResult } = require("express-validator");

function handleValidation(req, _res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const error = new Error("Validation failed");
  error.statusCode = 400;
  error.details = errors.array();
  return next(error);
}

module.exports = { handleValidation };
