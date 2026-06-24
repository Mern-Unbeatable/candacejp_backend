import Joi from 'joi';
import { DAY_OF_WEEK_OPTIONS, PREFERRED_TIME_OPTIONS } from '../utils/travelPreference.js';

const routeFields = {
  from: Joi.string().valid('NYC', 'TAMPA').required().messages({
    'any.only': 'From must be NYC or TAMPA.',
    'any.required': 'From is required.',
  }),
  to: Joi.string().valid('NYC', 'TAMPA').required().messages({
    'any.only': 'To must be NYC or TAMPA.',
    'any.required': 'To is required.',
  }),
  preferredTime: Joi.string()
    .valid(...PREFERRED_TIME_OPTIONS)
    .required()
    .messages({
      'any.only': 'Preferred time must be Morning, Afternoon, or Evening.',
      'any.required': 'Preferred time is required.',
    }),
};

class MemberValidation {
  createTravelPreference = Joi.object({
    type: Joi.string().valid('RECURRING', 'ONE_TIME').required().messages({
      'any.only': 'Type must be RECURRING or ONE_TIME.',
      'any.required': 'Type is required.',
    }),
    ...routeFields,
    dayOfWeek: Joi.when('type', {
      is: 'RECURRING',
      then: Joi.string()
        .valid(...DAY_OF_WEEK_OPTIONS)
        .required()
        .messages({
          'any.only': 'Day of week must be a valid weekday.',
          'any.required': 'Day of week is required for recurring travel.',
        }),
      otherwise: Joi.forbidden(),
    }),
    preferredDate: Joi.when('type', {
      is: 'ONE_TIME',
      then: Joi.date().iso().greater('now').required().messages({
        'date.greater': 'Preferred date must be in the future.',
        'any.required': 'Preferred date is required for one-time travel.',
      }),
      otherwise: Joi.forbidden(),
    }),
  }).custom((value, helpers) => {
    if (value.from === value.to) {
      return helpers.message('Origin and destination must be different.');
    }
    return value;
  });
}

export default new MemberValidation();
