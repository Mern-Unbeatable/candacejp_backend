import messageService from '../services/message.service.js';
import { getIO } from '../socket/index.js';
import { getMemberIdFromMessage, getMemberThreadRoomId } from '../utils/message.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

class MessageController {
  getConversations = async (req, res) => {
    try {
      const data = await messageService.getConversations(req.user.id);
      return sendSuccess(res, 'Conversations retrieved successfully.', data);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  getMessagesWithUser = async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const data = await messageService.getConversationMessages(
        req.user.id,
        req.params.userId,
        page,
        limit
      );
      return sendSuccess(res, 'Messages retrieved successfully.', data);
    } catch (error) {
      const status = error.message === 'User not found' ? 404 : 400;
      return sendError(res, error.message, status);
    }
  };

  markMessagesSeen = async (req, res) => {
    try {
      const { messageIds, partnerId } = req.body;
      const messages = messageIds?.length
        ? await messageService.markSeen(messageIds, req.user.id)
        : await messageService.markConversationSeen(req.user.id, partnerId);

      const io = getIO();
      if (io && messages.length) {
        const senderIds = [...new Set(messages.map((message) => message.senderId))];
        const memberIds = [...new Set(messages.map(getMemberIdFromMessage).filter(Boolean))];

        for (const senderId of senderIds) {
          const senderMessages = messages.filter((message) => message.senderId === senderId);
          io.to(`user:${senderId}`).emit('message:seen', {
            messages: senderMessages,
            viewerId: req.user.id,
          });
        }

        for (const memberId of memberIds) {
          io.to(getMemberThreadRoomId(memberId)).emit('message:seen', {
            messages,
            viewerId: req.user.id,
          });
        }
      }

      return sendSuccess(res, 'Messages marked as seen.', { messages });
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };
}

export default new MessageController();
