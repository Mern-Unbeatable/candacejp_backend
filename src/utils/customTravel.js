import { resolveRoute } from './travelPreference.js';

export function resolveCustomTravelRoute(origin, destination) {
  return resolveRoute(origin, destination);
}

export function normalizePassenger(passenger) {
  return {
    firstName: passenger.firstName.trim(),
    lastName: passenger.lastName.trim(),
    address: passenger.address?.trim() || null,
    zipCode: (passenger.zipCode || passenger.zip)?.trim() || null,
    email: passenger.email?.trim() || null,
    phone: passenger.phone?.trim() || null,
  };
}
