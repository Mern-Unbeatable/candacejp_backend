import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth.js';
import { disconnectUserSockets } from '../socket/index.js';

/**
 * Keep logout under Raven's policy boundary while delegating session
 * revocation to Better Auth. Disconnecting the user's room prevents an
 * already-open socket from receiving events after logout.
 */
export async function signOut(req, res, next) {
  try {
    const headers = fromNodeHeaders(req.headers);
    const sessionData = await auth.api.getSession({ headers });
    const response = await auth.api.signOut({
      headers,
      asResponse: true,
    });

    if (response.ok && sessionData?.user?.id) {
      disconnectUserSockets(sessionData.user.id);
    }

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const body = await response.arrayBuffer();
    return res.status(response.status).send(Buffer.from(body));
  } catch (error) {
    return next(error);
  }
}

