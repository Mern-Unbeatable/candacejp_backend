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
    phone: Joi.string().trim().pattern(/^\d{10,15}$/).required().messages({
      'string.pattern.base': 'Please provide a valid phone number (10-15 digits).',
      'any.required': 'Phone number is required.',
    }),
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

  forgotPassword = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email is required.',
    }),
  });

  verifyOtp = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email is required.',
    }),
    otp: Joi.string().length(5).pattern(/^\d+$/).required().messages({
      'string.length': 'Verification code must be 5 digits.',
      'string.pattern.base': 'Verification code must contain only numbers.',
      'any.required': 'Verification code is required.',
    }),
  });

  resetPassword = Joi.object({
    resetToken: Joi.string().required().messages({
      'any.required': 'Reset token is required.',
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long.',
      'any.required': 'Password is required.',
    }),
  });
}

export default new AuthValidation();