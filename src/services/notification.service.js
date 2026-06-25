import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';
import {
  formatRecurringDayLabel,
  formatPreferredDate,
} from '../utils/travelPreference.js';
import { formatDirectionLabel, formatCalendarDate, formatDisplayDate } from '../utils/memberInterest.js';
import { formatRoute } from '../utils/reservation.js';

const UI_TYPE_MAP = {
  TRAVEL_PREFERENCE_CANCELLED: 'cancelled',
  TRAVEL_PREFERENCE_CONFIRMED: 'confirmed',
  MEMBER_INTEREST_CONFIRMED: 'confirmed',
  RESERVATION_CONFIRMED: 'confirmed',
  OPPORTUNITY_NEW: 'new',
  OPPORTUNITY_CONFIRMED: 'confirmed',
  RESERVATION_PENDING: 'pending',
  TRIP_CONFIRMED: 'confirmed',
};

function buildTravelPreferenceNotificationPayload(preference) {
  const route = formatDirectionLabel(preference.direction);
  const travelLabel = preference.isRecurring ? 'recurring' : 'one-time';
  const schedule = preference.isRecurring
    ? `${formatRecurringDayLabel(preference.dayOfWeek)}${preference.preferredTime ? `, ${preference.preferredTime}` : ''}`
    : formatPreferredDate(preference.preferredDate);

  return { route, travelLabel, schedule };
}

function mapUiType(dbType) {
  return UI_TYPE_MAP[dbType] ?? 'update';
}

function parseNotificationContent(content) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      title: 'Notification',
      description: content,
    };
  }
}

export function formatNotification(notification) {
  const payload = parseNotificationContent(notification.content);

  return {
    id: notification.id,
    type: mapUiType(notification.type),
    notificationType: notification.type,
    title: payload.title,
    description: payload.description,
    route: payload.route ?? null,
    date: payload.date ?? null,
    referenceId: payload.referenceId ?? null,
    referenceType: payload.referenceType ?? null,
    opportunityId: payload.opportunityId ?? null,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

class NotificationService {
  async create(memberId, type, payload) {
    return prisma.notification.create({
      data: {
        memberId,
        type,
        content: JSON.stringify(payload),
      },
    });
  }

  async notifyTravelPreferenceCancelled(preference) {
    const { route, travelLabel, schedule } = buildTravelPreferenceNotificationPayload(preference);

    return this.create(preference.memberId, 'TRAVEL_PREFERENCE_CANCELLED', {
      title: 'Travel Preference Cancelled',
      description: `Your ${travelLabel} travel preference for ${route} has been cancelled by Raven Concierge.`,
      route,
      date: schedule,
      referenceId: preference.id,
      referenceType: 'TRAVEL_PREFERENCE',
    });
  }

  async notifyTravelPreferenceConfirmed(preference) {
    const { route, travelLabel, schedule } = buildTravelPreferenceNotificationPayload(preference);

    return this.create(preference.memberId, 'TRAVEL_PREFERENCE_CONFIRMED', {
      title: 'Travel Preference Confirmed',
      description: `Your ${travelLabel} travel preference for ${route} has been confirmed. It now appears in your upcoming trips.`,
      route,
      date: schedule,
      referenceId: preference.id,
      referenceType: 'TRAVEL_PREFERENCE',
    });
  }

  async notifyMemberInterestConfirmed(request) {
    const outboundRoute = formatDirectionLabel(request.direction);
    const returnRoute = request.returnDirection
      ? formatDirectionLabel(request.returnDirection)
      : null;
    const route = request.tripType === 'ROUND_TRIP' && returnRoute
      ? `${outboundRoute}, ${returnRoute}`
      : outboundRoute;
    const date = formatCalendarDate(request.departureDate);

    return this.create(request.memberId, 'MEMBER_INTEREST_CONFIRMED', {
      title: 'Custom Travel Request Confirmed',
      description: `Your custom travel request for ${route} has been confirmed. It now appears in your upcoming trips.`,
      route,
      date,
      referenceId: request.id,
      referenceType: 'CUSTOM_TRAVEL',
    });
  }

  async notifyReservationConfirmed(reservation) {
    const { opportunity } = reservation;
    const route = formatRoute(opportunity.origin, opportunity.destination);
    const date = formatDisplayDate(opportunity.departureDate);

    return this.create(reservation.memberId, 'RESERVATION_CONFIRMED', {
      title: 'Trip Confirmed',
      description: 'Great news! Your upcoming trip has been confirmed and booked.',
      route,
      date,
      referenceId: reservation.id,
      referenceType: 'RESERVATION',
      opportunityId: opportunity.id,
    });
  }

  buildOpportunityOpenPayload(opportunity) {
    const route = formatRoute(opportunity.origin, opportunity.destination);
    const date = formatDisplayDate(opportunity.departureDate);

    return {
      title: 'New Travel Opportunity',
      description: `A new travel opportunity for ${route} is now open for reservation.`,
      route,
      date,
      referenceId: opportunity.id,
      referenceType: 'OPPORTUNITY',
    };
  }

  async notifyAllMembersOpportunityOpen(opportunity) {
    const members = await prisma.user.findMany({
      where: { role: 'MEMBER', status: 'ACTIVE' },
      select: { id: true },
    });

    if (!members.length) {
      return;
    }

    const payload = this.buildOpportunityOpenPayload(opportunity);

    await prisma.notification.createMany({
      data: members.map((member) => ({
        memberId: member.id,
        type: 'OPPORTUNITY_NEW',
        content: JSON.stringify(payload),
      })),
    });
  }

  buildOpportunityConfirmedPayload(opportunity) {
    const route = formatRoute(opportunity.origin, opportunity.destination);
    const date = formatDisplayDate(opportunity.departureDate);

    return {
      title: 'Travel Opportunity Confirmed',
      description: `The travel opportunity for ${route} has been confirmed.`,
      route,
      date,
      referenceId: opportunity.id,
      referenceType: 'OPPORTUNITY',
    };
  }

  async notifyAllMembersOpportunityConfirmed(opportunity, excludeMemberIds = []) {
    const excludeSet = new Set(excludeMemberIds);

    const members = await prisma.user.findMany({
      where: { role: 'MEMBER', status: 'ACTIVE' },
      select: { id: true },
    });

    const recipients = members.filter((member) => !excludeSet.has(member.id));

    if (!recipients.length) {
      return;
    }

    const payload = this.buildOpportunityConfirmedPayload(opportunity);

    await prisma.notification.createMany({
      data: recipients.map((member) => ({
        memberId: member.id,
        type: 'OPPORTUNITY_CONFIRMED',
        content: JSON.stringify(payload),
      })),
    });
  }

  async getMemberNotifications(memberId, page = 1, limit = 10) {
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * perPage;

    const where = { memberId };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications: notifications.map(formatNotification),
      pagination: buildPagination(currentPage, perPage, total),
    };
  }

  async markAsRead(memberId, notificationId) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, memberId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return formatNotification(updated);
  }

  async markAllAsRead(memberId) {
    await prisma.notification.updateMany({
      where: { memberId, isRead: false },
      data: { isRead: true },
    });
  }
}

export default new NotificationService();
