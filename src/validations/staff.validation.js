import Joi from 'joi';

const nycPattern = /nyc|teb|jfk|new york/i;
const tampaPattern = /tampa|tpa/i;

function isValidCorridor(origin, destination) {
  const isNycToTampa = nycPattern.test(origin) && tampaPattern.test(destination);
  const isTampaToNyc = tampaPattern.test(origin) && nycPattern.test(destination);
  return isNycToTampa || isTampaToNyc;
}

function validateCorridor(value, helpers) {
  if (!isValidCorridor(value.origin, value.destination)) {
    return helpers.message('Route must be between New York and Tampa.');
  }
  return value;
}

class StaffValidation {
  createOpportunity = Joi.object({
    origin: Joi.string().trim().required().messages({
      'any.required': 'Origin is required.',
      'string.empty': 'Origin is required.',
    }),
    destination: Joi.string().trim().required().messages({
      'any.required': 'Destination is required.',
      'string.empty': 'Destination is required.',
    }),
    tripType: Joi.string().valid('ONE_WAY', 'ROUND_TRIP').required().messages({
      'any.only': 'Trip type must be ONE_WAY or ROUND_TRIP.',
      'any.required': 'Trip type is required.',
    }),
    departureDate: Joi.date().iso().greater('now').required().messages({
      'date.greater': 'Departure date must be in the future.',
      'any.required': 'Departure date is required.',
    }),
    returnDate: Joi.when('tripType', {
      is: 'ROUND_TRIP',
      then: Joi.date().iso().greater(Joi.ref('departureDate')).required().messages({
        'any.required': 'Return date is required for round trips.',
        'date.greater': 'Return date must be after departure date.',
      }),
      otherwise: Joi.forbidden(),
    }),
    estimatedPrice: Joi.number().positive().required().messages({
      'number.positive': 'Estimated price must be greater than 0.',
      'any.required': 'Estimated price is required.',
    }),
    aircraftType: Joi.string().trim().optional().allow('', null),
    totalCapacity: Joi.number().integer().min(1).required().messages({
      'number.min': 'Total capacity must be at least 1.',
      'any.required': 'Total capacity is required.',
    }),
    status: Joi.string().valid('DRAFT', 'OPEN_FOR_RESERVATION').default('DRAFT'),
  }).custom(validateCorridor);

  editOpportunity = Joi.object({
    origin: Joi.string().trim(),
    destination: Joi.string().trim(),
    tripType: Joi.string().valid('ONE_WAY', 'ROUND_TRIP'),
    departureDate: Joi.date().iso().greater('now'),
    returnDate: Joi.date().iso().allow(null),
    estimatedPrice: Joi.number().positive(),
    aircraftType: Joi.string().trim().allow('', null),
    totalCapacity: Joi.number().integer().min(1),
  })
    .min(1)
    .messages({
      'object.min': 'At least one field is required to update the opportunity.',
    })
    .custom((value, helpers) => {
      if (value.origin && value.destination && !isValidCorridor(value.origin, value.destination)) {
        return helpers.message('Route must be between New York and Tampa.');
      }
      return value;
    });

  updateOpportunityStatus = Joi.object({
    status: Joi.string().valid('CONFIRMED', 'COMPLETED').required().messages({
      'any.only': 'Status must be CONFIRMED or COMPLETED.',
      'any.required': 'Status is required.',
    }),
  });

  updateTravelPreferenceStatus = Joi.object({
    status: Joi.string()
      .valid('Interested', 'Confirmed', 'Canceled', 'INTERESTED', 'CONFIRMED', 'CANCELED', 'CANCELLED')
      .required()
      .messages({
        'any.only': 'Status must be Interested, Confirmed, or Canceled.',
        'any.required': 'Status is required.',
      }),
  });
}

export default new StaffValidation();
