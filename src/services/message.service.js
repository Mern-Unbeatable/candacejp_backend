import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';
import { canUsersMessage, formatMessage } from '../utils/message.js';
import { isUserOnline } from '../socket/presence.store.js';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
};

class MessageService {
  async getActiveUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User not found');
    }

    return user;
  }

  async getActiveConciergeIds() {
    const concierges = await prisma.user.findMany({
      where: { role: 'CONCIERGE', status: 'ACTIVE' },
      select: { id: true },
    });

    return concierges.map((concierge) => concierge.id);
  }

  buildMemberConciergeThreadWhere(memberId, conciergeIds) {
    return {
      OR: [
        { senderId: memberId, receiverId: { in: conciergeIds } },
        { senderId: { in: conciergeIds }, receiverId: memberId },
      ],
    };
  }

  async validateMessagingUsers(senderId, receiverId) {
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId }, select: { id: true, role: true, status: true } }),
      prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, role: true, status: true } }),
    ]);

    if (!sender || !receiver) {
      throw new Error('User not found');
    }

    if (sender.status !== 'ACTIVE' || receiver.status !== 'ACTIVE') {
      throw new Error('Messaging is only available for active accounts');
    }

    if (!canUsersMessage(sender.role, receiver.role)) {
      throw new Error('You are not allowed to message this user');
    }

    return { sender, receiver };
  }

  async validateConversationAccess(viewerId, partnerId) {
    const [viewer, partner] = await Promise.all([
      this.getActiveUser(viewerId),
      prisma.user.findUnique({
        where: { id: partnerId },
        select: { id: true, role: true, status: true },
      }),
    ]);

    if (!partner || partner.status !== 'ACTIVE') {
      throw new Error('User not found');
    }

    if (viewer.role === 'MEMBER' && partner.role !== 'CONCIERGE') {
      throw new Error('Members can only view conversations with concierge staff');
    }

    if (viewer.role === 'CONCIERGE' && partner.role !== 'MEMBER') {
      throw new Error('Concierge staff can only view conversations with members');
    }

    return { viewer, partner };
  }

  async createMessage(senderId, receiverId, content) {
    await this.validateMessagingUsers(senderId, receiverId);

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content: content.trim(),
        status: 'SENT',
      },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    });

    return formatMessage(message);
  }

  async markDelivered(messageId, receiverId) {
    const viewer = await this.getActiveUser(receiverId);
    const conciergeIds = viewer.role === 'CONCIERGE' ? await this.getActiveConciergeIds() : null;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        status: 'SENT',
        ...(viewer.role === 'CONCIERGE'
          ? { receiverId: { in: conciergeIds }, sender: { role: 'MEMBER' } }
          : { receiverId }),
      },
    });

    if (!message) {
      return null;
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    });

    return formatMessage(updated);
  }

  async markSeen(messageIds, viewerId) {
    const uniqueIds = [...new Set(messageIds)];
    if (!uniqueIds.length) {
      return [];
    }

    const viewer = await this.getActiveUser(viewerId);
    const conciergeIds = viewer.role === 'CONCIERGE' ? await this.getActiveConciergeIds() : null;

    const where = {
      id: { in: uniqueIds },
      status: { in: ['SENT', 'DELIVERED'] },
    };

    if (viewer.role === 'MEMBER') {
      where.receiverId = viewerId;
    } else {
      where.receiverId = { in: conciergeIds };
      where.sender = { role: 'MEMBER' };
    }

    const messages = await prisma.message.findMany({ where });

    if (!messages.length) {
      return [];
    }

    const now = new Date();

    await prisma.message.updateMany({
      where: { id: { in: messages.map((message) => message.id) } },
      data: {
        status: 'SEEN',
        isRead: true,
        seenAt: now,
        deliveredAt: now,
      },
    });

    const updated = await prisma.message.findMany({
      where: { id: { in: messages.map((message) => message.id) } },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    });

    return updated.map(formatMessage);
  }

  async markConversationSeen(viewerId, partnerId) {
    await this.validateConversationAccess(viewerId, partnerId);

    const viewer = await this.getActiveUser(viewerId);

    if (viewer.role === 'CONCIERGE') {
      const conciergeIds = await this.getActiveConciergeIds();
      const messages = await prisma.message.findMany({
        where: {
          senderId: partnerId,
          receiverId: { in: conciergeIds },
          status: { in: ['SENT', 'DELIVERED'] },
        },
        select: { id: true },
      });

      return this.markSeen(messages.map((message) => message.id), viewerId);
    }

    const messages = await prisma.message.findMany({
      where: {
        senderId: partnerId,
        receiverId: viewerId,
        status: { in: ['SENT', 'DELIVERED'] },
      },
      select: { id: true },
    });

    return this.markSeen(messages.map((message) => message.id), viewerId);
  }

  async getConversationMessages(userId, partnerId, page = 1, limit = 50) {
    const { viewer, partner } = await this.validateConversationAccess(userId, partnerId);

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const skip = (currentPage - 1) * perPage;

    let where;

    if (viewer.role === 'MEMBER') {
      where = {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      };
    } else {
      const conciergeIds = await this.getActiveConciergeIds();
      where = this.buildMemberConciergeThreadWhere(partnerId, conciergeIds);
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: userSelect },
          receiver: { select: userSelect },
        },
      }),
      prisma.message.count({ where }),
    ]);

    return {
      messages: messages.map(formatMessage),
      pagination: buildPagination(currentPage, perPage, total),
      partner: {
        id: partnerId,
        isOnline: isUserOnline(partnerId),
      },
      sharedInbox: viewer.role === 'CONCIERGE',
    };
  }

  async getConversations(userId) {
    const viewer = await this.getActiveUser(userId);

    if (viewer.role === 'MEMBER') {
      return this.getMemberConversations(userId);
    }

    return this.getConciergeConversations();
  }

  async getMemberConversations(userId) {
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    });

    const conversations = new Map();

    for (const message of messages) {
      const partner = message.senderId === userId ? message.receiver : message.sender;

      if (!partner || partner.role !== 'CONCIERGE' || conversations.has(partner.id)) {
        continue;
      }

      const unreadCount = await prisma.message.count({
        where: {
          senderId: partner.id,
          receiverId: userId,
          status: { in: ['SENT', 'DELIVERED'] },
        },
      });

      conversations.set(partner.id, {
        partner: {
          ...partner,
          fullName: `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim(),
          isOnline: isUserOnline(partner.id),
        },
        lastMessage: formatMessage(message),
        unreadCount,
        sharedInbox: false,
      });
    }

    return {
      conversations: Array.from(conversations.values()),
    };
  }

  async getConciergeConversations() {
    const conciergeIds = await this.getActiveConciergeIds();
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: { in: conciergeIds }, receiver: { role: 'MEMBER' } },
          { receiverId: { in: conciergeIds }, sender: { role: 'MEMBER' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    });

    const conversations = new Map();

    for (const message of messages) {
      const member = message.sender.role === 'MEMBER' ? message.sender : message.receiver;

      if (!member || conversations.has(member.id)) {
        continue;
      }

      const unreadCount = await prisma.message.count({
        where: {
          senderId: member.id,
          receiverId: { in: conciergeIds },
          status: { in: ['SENT', 'DELIVERED'] },
        },
      });

      conversations.set(member.id, {
        partner: {
          ...member,
          fullName: `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim(),
          isOnline: isUserOnline(member.id),
        },
        lastMessage: formatMessage(message),
        unreadCount,
        sharedInbox: true,
      });
    }

    return {
      conversations: Array.from(conversations.values()),
    };
  }
}

export default new MessageService();
