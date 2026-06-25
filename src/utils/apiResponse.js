export function sendSuccess(res, message, data = null, status = 200) {
  const body = { success: true, message };

  if (data !== null && data !== undefined) {
    body.data = data;
  }

  return res.status(status).json(body);
}

export function sendError(res, message, status = 400, extras = null) {
  const body = { success: false, message };

  if (extras) {
    Object.assign(body, extras);
  }

  return res.status(status).json(body);
}
