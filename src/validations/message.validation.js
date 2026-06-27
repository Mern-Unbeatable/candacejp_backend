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
}

export default new MessageValidation();
