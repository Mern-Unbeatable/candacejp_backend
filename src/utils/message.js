export function getConversationRoomId(userIdA, userIdB) {
  return `conversation:${[userIdA, userIdB].sort().join(':')}`;
}

export function getMemberThreadRoomId(memberId) {
  return `conversation:member:${memberId}`;
}

export function getMemberIdFromMessage(message) {
  if (message.sender?.role === 'MEMBER') {
    return message.senderId;
  }

  if (message.receiver?.role === 'MEMBER') {
    return message.receiverId;
  }

  return null;
}

export function canUsersMessage(senderRole, receiverRole) {
  const allowedPairs = new Set([
    'MEMBER:CONCIERGE',
    'CONCIERGE:MEMBER',
  ]);

  return allowedPairs.has(`${senderRole}:${receiverRole}`);
}

export function getMessageTickType(status) {
  switch (status) {
    case 'DELIVERED':
      return 'double_blue';
    case 'SEEN':
      return 'double_green';
    case 'SENT':
    default:
      return 'single';
  }
}

export function matchesPartnerSearch(partner, search) {
  const term = search.trim().toLowerCase();
  if (!term) {
    return true;
  }

  const firstName = (partner.firstName ?? '').toLowerCase();
  const lastName = (partner.lastName ?? '').toLowerCase();
  const email = (partner.email ?? '').toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName.includes(term) || email.includes(term)) {
    return true;
  }

  const words = term.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const firstWord = words[0];
    const remaining = words.slice(1).join(' ');
    if (firstName.includes(firstWord) && lastName.includes(remaining)) {
      return true;
    }
  }

  return firstName.includes(term) || lastName.includes(term);
}

export function buildMemberSearchWhere(search) {
  const term = search.trim();
  const words = term.split(/\s+/).filter(Boolean);
  const conditions = [
    { firstName: { contains: term, mode: 'insensitive' } },
    { lastName: { contains: term, mode: 'insensitive' } },
    { email: { contains: term, mode: 'insensitive' } },
  ];

  if (words.length >= 2) {
    conditions.push({
      AND: [
        { firstName: { contains: words[0], mode: 'insensitive' } },
        { lastName: { contains: words.slice(1).join(' '), mode: 'insensitive' } },
      ],
    });
  }

  return { OR: conditions };
}

export function formatMessage(message) {
  return {
    id: message.id,
    content: message.isDeleted ? null : message.content,
    senderId: message.senderId,
    receiverId: message.receiverId,
    status: message.status,
    tickType: getMessageTickType(message.status),
    isRead: message.isRead,
    isDeleted: message.isDeleted ?? false,
    deliveredAt: message.deliveredAt,
    seenAt: message.seenAt,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt ?? message.createdAt,
    sender: message.sender
      ? {
          id: message.sender.id,
          firstName: message.sender.firstName,
          lastName: message.sender.lastName,
          email: message.sender.email,
          role: message.sender.role,
        }
      : undefined,
    receiver: message.receiver
      ? {
          id: message.receiver.id,
          firstName: message.receiver.firstName,
          lastName: message.receiver.lastName,
          email: message.receiver.email,
          role: message.receiver.role,
        }
      : undefined,
  };
}
