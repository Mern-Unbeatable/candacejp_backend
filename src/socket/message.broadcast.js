import { getMemberIdFromMessage, getMemberThreadRoomId } from '../utils/message.js';

export function broadcastMessageEvent(io, message, event) {
  const memberId = getMemberIdFromMessage(message);

  io.to(`user:${message.senderId}`).emit(event, { message });
  io.to(`user:${message.receiverId}`).emit(event, { message });

  if (memberId) {
    io.to(getMemberThreadRoomId(memberId)).emit(event, { message });
  }
}
