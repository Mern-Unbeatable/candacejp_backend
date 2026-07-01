import Joi from 'joi';

class MessageValidation {
  markSeen = Joi.object({
    messageIds: Joi.array().items(Joi.string().uuid()).min(1),
    partnerId: Joi.string().uuid(),
  })
    .or('messageIds', 'partnerId')
    .messages({
      'object.missing': 'Either messageIds or partnerId is required.',
    });

  updateMessage = Joi.object({
    content: Joi.string().trim().min(1).max(5000).required().messages({
      'string.empty': 'Message content is required.',
      'any.required': 'Message content is required.',
      'string.max': 'Message content must be at most 5000 characters.',
    }),
  });
}

export default new MessageValidation();
