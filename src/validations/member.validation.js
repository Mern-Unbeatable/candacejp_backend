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

  createCustomTravel = Joi.object({
    tripType: Joi.string().valid('ONE_WAY', 'ROUND_TRIP').required().messages({
      'any.only': 'Trip type must be ONE_WAY or ROUND_TRIP.',
      'any.required': 'Trip type is required.',
    }),
    origin: Joi.string().valid('NYC', 'TAMPA').required().messages({
      'any.only': 'Origin must be NYC or TAMPA.',
      'any.required': 'Origin is required.',
    }),
    destination: Joi.string().valid('NYC', 'TAMPA').required().messages({
      'any.only': 'Destination must be NYC or TAMPA.',
      'any.required': 'Destination is required.',
    }),
    returnOrigin: Joi.when('tripType', {
      is: 'ROUND_TRIP',
      then: Joi.string().valid('NYC', 'TAMPA').required().messages({
        'any.only': 'Return origin must be NYC or TAMPA.',
        'any.required': 'Return origin is required for round trips.',
      }),
      otherwise: Joi.forbidden(),
    }),
    returnDestination: Joi.when('tripType', {
      is: 'ROUND_TRIP',
      then: Joi.string().valid('NYC', 'TAMPA').required().messages({
        'any.only': 'Return destination must be NYC or TAMPA.',
        'any.required': 'Return destination is required for round trips.',
      }),
      otherwise: Joi.forbidden(),
    }),
    departureDate: Joi.date().iso().greater('now').required().messages({
      'date.greater': 'Departure date must be in the future.',
      'any.required': 'Departure date is required.',
    }),
    returnDate: Joi.when('tripType', {
      is: 'ROUND_TRIP',
      then: Joi.date().iso().greater(Joi.ref('departureDate')).required().messages({
        'date.greater': 'Return date must be after departure date.',
        'any.required': 'Return date is required for round trips.',
      }),
      otherwise: Joi.forbidden(),
    }),
    passengerCount: Joi.number().integer().min(1).max(8).required().messages({
      'number.min': 'At least 1 passenger is required.',
      'number.max': 'A maximum of 8 passengers is allowed.',
      'any.required': 'Passenger count is required.',
    }),
    passengers: Joi.array()
      .items(
        Joi.object({
          firstName: Joi.string().trim().required().messages({
            'any.required': 'Passenger first name is required.',
          }),
          lastName: Joi.string().trim().required().messages({
            'any.required': 'Passenger last name is required.',
          }),
          address: Joi.string().trim().required().messages({
            'any.required': 'Passenger street address is required.',
          }),
          zipCode: Joi.string().trim(),
          zip: Joi.string().trim(),
          email: Joi.string().email().required().messages({
            'string.email': 'Passenger email must be valid.',
            'any.required': 'Passenger email is required.',
          }),
          phone: Joi.string().trim().pattern(/^\d{10,15}$/).required().messages({
            'string.pattern.base': 'Passenger phone must be 10-15 digits.',
            'any.required': 'Passenger phone is required.',
          }),
        })
      )
      .min(1)
      .max(8)
      .required()
      .messages({
        'any.required': 'Passenger information is required.',
      }),
    specialRequests: Joi.string().trim().allow('', null).optional(),
  })
    .custom((value, helpers) => {
      if (value.origin === value.destination) {
        return helpers.message('Origin and destination must be different.');
      }

      if (value.tripType === 'ROUND_TRIP' && value.returnOrigin === value.returnDestination) {
        return helpers.message('Return origin and return destination must be different.');
      }

      if (value.passengers.length !== value.passengerCount) {
        return helpers.message('Passenger count must match the number of passenger records provided.');
      }

      return value;
    });
}

export default new MemberValidation();
