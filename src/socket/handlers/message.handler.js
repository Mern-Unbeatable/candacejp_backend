import {
  getConversationRoomId,
  getMemberIdFromMessage,
  getMemberThreadRoomId,
} from '../../utils/message.js';
import messageService from '../../services/message.service.js';
import {
  addUserSocket,
  isUserOnline,
  removeUserSocket,
} from '../presence.store.js';

function emitPresence(io, userId, isOnline) {
  io.emit('presence:update', { userId, isOnline });
}

function emitToUser(io, userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}

function emitToMemberThread(io, memberId, event, payload) {
  io.to(getMemberThreadRoomId(memberId)).emit(event, payload);
}

async function markDeliveredForMessage(io, socket, message) {
  const receiverId = message.receiverId;

  if (isUserOnline(receiverId)) {
    const delivered = await messageService.markDelivered(message.id, receiverId);
    if (delivered) {
      socket.emit('message:status', { message: delivered });
      emitToUser(io, message.senderId, 'message:status', { message: delivered });
      const memberId = getMemberIdFromMessage(delivered);
      if (memberId) {
        emitToMemberThread(io, memberId, 'message:status', { message: delivered });
      }
    }
    return;
  }

  if (message.sender?.role === 'MEMBER') {
    const conciergeIds = await messageService.getActiveConciergeIds();
    const onlineConciergeId = conciergeIds.find((conciergeId) => isUserOnline(conciergeId));

    if (!onlineConciergeId) {
      return;
    }

    const delivered = await messageService.markDelivered(message.id, onlineConciergeId);
    if (delivered) {
      socket.emit('message:status', { message: delivered });
      emitToUser(io, message.senderId, 'message:status', { message: delivered });
      emitToMemberThread(io, message.senderId, 'message:status', { message: delivered });
    }
  }
}

function broadcastMessageEvent(io, message, event) {
  const memberId = getMemberIdFromMessage(message);
  emitToUser(io, message.senderId, event, { message });
  emitToUser(io, message.receiverId, event, { message });

  if (memberId) {
    emitToMemberThread(io, memberId, event, { message });
  }
}

export function registerMessageHandlers(io, socket) {
  const userId = socket.user.id;
  const userRole = socket.user.role;

  socket.on('conversation:join', async ({ partnerId }, callback) => {
    try {
      await messageService.validateConversationAccess(userId, partnerId);

      const memberId = userRole === 'MEMBER' ? userId : partnerId;
      socket.join(getMemberThreadRoomId(memberId));
      socket.join(getConversationRoomId(userId, partnerId));

      const response = {
        roomId: getMemberThreadRoomId(memberId),
        partnerId,
        partnerOnline: isUserOnline(partnerId),
        sharedInbox: userRole === 'CONCIERGE',
      };

      if (typeof callback === 'function') {
        callback({ success: true, data: response });
      }

      socket.emit('conversation:joined', response);
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on('conversation:leave', ({ partnerId }) => {
    const memberId = userRole === 'MEMBER' ? userId : partnerId;
    socket.leave(getMemberThreadRoomId(memberId));
    socket.leave(getConversationRoomId(userId, partnerId));
  });

  socket.on('message:send', async ({ receiverId, content }, callback) => {
    try {
      const message = await messageService.createMessage(userId, receiverId, content);

      broadcastMessageEvent(io, message, 'message:new');
      await markDeliveredForMessage(io, socket, message);

      if (typeof callback === 'function') {
        callback({ success: true, data: { message } });
      }

      socket.emit('message:sent', { message });
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on('message:delivered', async ({ messageId }, callback) => {
    try {
      const message = await messageService.markDelivered(messageId, userId);
      if (!message) {
        if (typeof callback === 'function') {
          callback({ success: false, message: 'Message not found or already delivered' });
        }
        return;
      }

      emitToUser(io, message.senderId, 'message:status', { message });
      const memberId = getMemberIdFromMessage(message);
      if (memberId) {
        emitToMemberThread(io, memberId, 'message:status', { message });
      }

      if (typeof callback === 'function') {
        callback({ success: true, data: { message } });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on('message:seen', async ({ messageIds, partnerId }, callback) => {
    try {
      const updatedMessages = messageIds?.length
        ? await messageService.markSeen(messageIds, userId)
        : await messageService.markConversationSeen(userId, partnerId);

      const senderIds = [...new Set(updatedMessages.map((message) => message.senderId))];
      const memberIds = [...new Set(updatedMessages.map(getMemberIdFromMessage).filter(Boolean))];

      for (const senderId of senderIds) {
        const senderMessages = updatedMessages.filter((message) => message.senderId === senderId);
        emitToUser(io, senderId, 'message:seen', { messages: senderMessages, viewerId: userId });
      }

      for (const memberId of memberIds) {
        emitToMemberThread(io, memberId, 'message:seen', {
          messages: updatedMessages,
          viewerId: userId,
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, data: { messages: updatedMessages } });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on('typing:start', ({ receiverId }) => {
    const memberId = userRole === 'MEMBER' ? userId : receiverId;
    const payload = {
      userId,
      partnerId: receiverId,
      memberId,
      isTyping: true,
    };

    emitToUser(io, receiverId, 'typing:update', payload);
    emitToMemberThread(io, memberId, 'typing:update', payload);
  });

  socket.on('typing:stop', ({ receiverId }) => {
    const memberId = userRole === 'MEMBER' ? userId : receiverId;
    const payload = {
      userId,
      partnerId: receiverId,
      memberId,
      isTyping: false,
    };

    emitToUser(io, receiverId, 'typing:update', payload);
    emitToMemberThread(io, memberId, 'typing:update', payload);
  });

  socket.on('presence:check', ({ userIds = [] }, callback) => {
    const onlineStatus = userIds.map((id) => ({
      userId: id,
      isOnline: isUserOnline(id),
    }));

    if (typeof callback === 'function') {
      callback({ success: true, data: { users: onlineStatus } });
    } else {
      socket.emit('presence:status', { users: onlineStatus });
    }
  });
}

export function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;

  socket.join(`user:${userId}`);

  if (socket.user.role === 'CONCIERGE') {
    socket.join('concierge:team');
  }

  addUserSocket(userId, socket.id);
  emitPresence(io, userId, true);

  socket.on('disconnect', () => {
    const stillOnline = removeUserSocket(userId, socket.id);
    if (!stillOnline) {
      emitPresence(io, userId, false);
    }
  });
}
