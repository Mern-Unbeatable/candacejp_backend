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

export function formatMessage(message) {
  return {
    id: message.id,
    content: message.content,
    senderId: message.senderId,
    receiverId: message.receiverId,
    status: message.status,
    tickType: getMessageTickType(message.status),
    isRead: message.isRead,
    deliveredAt: message.deliveredAt,
    seenAt: message.seenAt,
    createdAt: message.createdAt,
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
