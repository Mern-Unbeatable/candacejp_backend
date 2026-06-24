export async function getActivePassengerCount(prismaClient, opportunityId) {
  return prismaClient.reservationPassenger.count({
    where: {
      reservation: {
        opportunityId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    },
  });
}

export function formatRoute(origin, destination) {
  return `${origin} → ${destination}`;
}

export function getAvailabilityLabel(availableSeat, totalSeat) {
  if (availableSeat <= 0) return 'Full';
  if (availableSeat <= Math.ceil(totalSeat * 0.25)) return 'Filling Fast';
  return 'Available';
}

export function formatOpportunityForMember(opportunity, bookedSeats, memberReservation = null) {
  const availableSeat = Math.max(opportunity.totalCapacity - bookedSeats, 0);

  return {
    id: opportunity.id,
    route: formatRoute(opportunity.origin, opportunity.destination),
    direction: opportunity.direction,
    origin: opportunity.origin,
    destination: opportunity.destination,
    aircraft: opportunity.aircraftType,
    aircraftType: opportunity.aircraftType,
    tripType: opportunity.tripType,
    departureDate: opportunity.departureDate,
    returnDate: opportunity.returnDate,
    estimatedPrice: opportunity.estimatedPrice,
    costFormatted: opportunity.estimatedPrice,
    totalSeats: opportunity.totalCapacity,
    totalSeat: opportunity.totalCapacity,
    seatsAvailable: availableSeat,
    availableSeat,
    totalBooked: bookedSeats,
    status: getAvailabilityLabel(availableSeat, opportunity.totalCapacity),
    opportunityStatus: opportunity.status,
    hasReservation: Boolean(memberReservation),
    reservationId: memberReservation?.id ?? null,
    reservationStatus: memberReservation?.status ?? null,
  };
}

export function formatReservationForMember(reservation) {
  const { opportunity, passengers, ...rest } = reservation;
  const passengerList = passengers.map(({ passenger }) => ({
    id: passenger.id,
    firstName: passenger.firstName,
    lastName: passenger.lastName,
    fullName: `${passenger.firstName} ${passenger.lastName}`.trim(),
    email: passenger.email,
    phone: passenger.phone,
    address: passenger.address,
  }));

  return {
    id: rest.id,
    status: rest.status,
    specialRequests: rest.specialRequests,
    reservedDate: rest.createdAt,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
    route: formatRoute(opportunity.origin, opportunity.destination),
    direction: opportunity.direction,
    origin: opportunity.origin,
    destination: opportunity.destination,
    aircraft: opportunity.aircraftType,
    aircraftType: opportunity.aircraftType,
    tripType: opportunity.tripType,
    departureDate: opportunity.departureDate,
    returnDate: opportunity.returnDate,
    estimatedPrice: opportunity.estimatedPrice,
    costFormatted: opportunity.estimatedPrice,
    type: 'Opportunities',
    passengers: passengerList,
    passengerCount: passengerList.length,
    opportunity: {
      id: opportunity.id,
      status: opportunity.status,
    },
  };
}
