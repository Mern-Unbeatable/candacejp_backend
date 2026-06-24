import Joi from 'joi';

class UserValidation {
  changePassword = Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required.',
    }),
    newPassword: Joi.string().min(8).required().invalid(Joi.ref('currentPassword')).messages({
      'string.min': 'New password must be at least 8 characters long.',
      'any.required': 'New password is required.',
      'any.invalid': 'New password must be different from your current password.',
    }),
  });
}

export default new UserValidation();
