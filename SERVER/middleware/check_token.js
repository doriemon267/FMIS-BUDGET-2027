const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const check_token_dev = require("./check_token_dev");
const check_token_prod = require("./check_token_prod");

/**
 * Unified Authentication Middleware Dispatcher
 * Automatically selects between dev and prod implementations based on PRODUCTION_MODE
 */
module.exports = (req, res, next) => {
  if (IS_PRODUCTION) {
    return check_token_prod(req, res, next);
  } else {
    return check_token_dev(req, res, next);
  }
};
