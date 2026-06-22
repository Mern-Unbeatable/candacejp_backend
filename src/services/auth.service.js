import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class AuthService {
  // ... register and verifyPayment remain exactly the same ...

  // Helper method to generate both tokens
  generateTokens(user) {
    const payload = { id: user.id, role: user.role, status: user.status };
    
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { 
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' 
    });
    
    // Refresh tokens usually only need the user ID
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' 
    });

    return { accessToken, refreshToken };
  }

  async login(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid credentials");

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new Error("Invalid credentials");

    if (user.status === 'PENDING_PAYMENT') throw new Error("PaymentRequired");

    // Generate both tokens
    const tokens = this.generateTokens(user);

    return {
      ...tokens,
      user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role }
    };
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new Error("No refresh token provided");

    try {
      // 1. Verify the refresh token using the specific REFRESH secret
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // 2. Make sure the user still exists and is active
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user || user.status !== 'ACTIVE') {
        throw new Error("User account is no longer active");
      }

      // 3. Generate a brand new Access Token (and optionally a new refresh token)
      const tokens = this.generateTokens(user);
      return tokens;

    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }
}

export default new AuthService();