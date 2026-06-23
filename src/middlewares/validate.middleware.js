import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');

      logger.warn(`Validation failed for ${req.originalUrl}: ${errorMessage}`);

      return sendError(res, errorMessage, 400);
    }

    next();
  };
};

export default validate;