const CONFIRMED_OPPORTUNITY_STATUS = 'CONFIRMED';
const CONFIRMED_CUSTOM_TRAVEL_STATUS = 'CONFIRMED';
const CONFIRMED_TRAVEL_PREFERENCE_STATUS = 'Confirmed';

export async function countScheduledFlights(prismaClient) {
    const [opportunities, customTravel, travelPreferences] = await Promise.all([
        prismaClient.opportunity.count({ where: { status: CONFIRMED_OPPORTUNITY_STATUS } }),
        prismaClient.customTravelRequest.count({ where: { status: CONFIRMED_CUSTOM_TRAVEL_STATUS } }),
        prismaClient.travelPreference.count({ where: { status: CONFIRMED_TRAVEL_PREFERENCE_STATUS } }),
    ]);

    return opportunities + customTravel + travelPreferences;
}

export async function getScheduledFlightConfirmations(prismaClient, { start, end } = {}) {
    const updatedAtFilter = start && end ? { updatedAt: { gte: start, lt: end } } : {};

    const [opportunities, customTravel, travelPreferences] = await Promise.all([
        prismaClient.opportunity.findMany({
            where: { status: CONFIRMED_OPPORTUNITY_STATUS, ...updatedAtFilter },
            select: { updatedAt: true },
        }),
        prismaClient.customTravelRequest.findMany({
            where: { status: CONFIRMED_CUSTOM_TRAVEL_STATUS, ...updatedAtFilter },
            select: { updatedAt: true },
        }),
        prismaClient.travelPreference.findMany({
            where: { status: CONFIRMED_TRAVEL_PREFERENCE_STATUS, ...updatedAtFilter },
            select: { updatedAt: true },
        }),
    ]);

    return [...opportunities, ...customTravel, ...travelPreferences];
}
