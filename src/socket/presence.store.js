const onlineUsers = new Map();

export function addUserSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socketId);
}

export function removeUserSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) {
    return false;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return false;
  }

  return true;
}

export function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

export function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}
