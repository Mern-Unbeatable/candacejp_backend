import Joi from 'joi';

class AuthValidation {
  // Rules for Registration
  register = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email is required.'
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long.',
      'any.required': 'Password is required.'
    }),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    phone: Joi.string().required(),
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required()
  });

  // Rules for Login
  login = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  resumePayment = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email is required.',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required.',
    }),
  });
}

export default new AuthValidation();