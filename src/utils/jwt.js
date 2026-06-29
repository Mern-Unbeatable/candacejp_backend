import jwt from 'jsonwebtoken'

export function getTokenExpiryMeta(token) {
  const decoded = jwt.decode(token)

  if (!decoded?.exp) {
    return {
      expiresAt: null,
      expiresIn: null,
    }
  }

  const expiresAt = new Date(decoded.exp * 1000).toISOString()
  const expiresIn = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))

  return { expiresAt, expiresIn }
}

export function withTokenExpiryMeta(accessToken, refreshToken) {
  const access = getTokenExpiryMeta(accessToken)
  const refresh = getTokenExpiryMeta(refreshToken)

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: access.expiresAt,
    accessTokenExpiresIn: access.expiresIn,
    refreshTokenExpiresAt: refresh.expiresAt,
    refreshTokenExpiresIn: refresh.expiresIn,
  }
}
