import Joi from 'joi';

class SupportValidation {
  create = Joi.object({
    name: Joi.string().trim().required().messages({
      'any.required': 'Name is required.',
      'string.empty': 'Name is required.',
    }),
    phone: Joi.string().trim().required().messages({
      'any.required': 'Phone number is required.',
      'string.empty': 'Phone number is required.',
    }),
    email: Joi.string().trim().email().required().messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email is required.',
      'string.empty': 'Email is required.',
    }),
    message: Joi.string().trim().required().messages({
      'any.required': 'Message is required.',
      'string.empty': 'Message is required.',
    }),
  });

  updateStatus = Joi.object({
    status: Joi.string().valid('SOLVED').required().messages({
      'any.only': 'Status must be SOLVED.',
      'any.required': 'Status is required.',
    }),
  });
}

export default new SupportValidation();
