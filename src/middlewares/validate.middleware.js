import logger from '../utils/logger.js';

const validate = (schema) => {
  return (req, res, next) => {
    // Validate the request body against the Joi schema
    // abortEarly: false makes sure Joi returns ALL errors, not just the first one it finds
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      // Map through all the errors and combine them into a readable string
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      
      logger.warn(`Validation failed for ${req.originalUrl}: ${errorMessage}`);
      
      // Return a 400 Bad Request immediately. The controller/service is never reached!
      return res.status(400).json({ error: errorMessage });
    }

    next(); // If validation passes, move on to the controller
  };
};

export default validate;