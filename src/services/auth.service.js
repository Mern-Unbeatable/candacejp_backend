import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import prisma from '../lib/prisma.js';
import { getInactiveAccountErrorCode } from '../utils/accountStatus.js';
import { withTokenExpiryMeta } from '../utils/jwt.js';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key);
}

function sanitizeUser(user) {
  if (!user) return user
  const { password, stripeCustomerId, ...safeUser } = user
  return safeUser
}

class AuthService {
  // Helper method to generate both access and refresh tokens
  generateTokens(user) {
    const payload = { id: user.id, role: user.role, status: user.status };

    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });

    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return withTokenExpiryMeta(accessToken, refreshToken);
  }

  async createRegistrationCheckoutSession(user, { cancelUrl } = {}) {
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Raven Membership Registration',
              description: 'One-time registration fee for the Raven platform.',
            },
            unit_amount: 19900,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      client_reference_id: user.id,
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${process.env.CLIENT_URL}/register`,
    };

    if (user.stripeCustomerId) {
      sessionConfig.customer = user.stripeCustomerId;
    } else {
      sessionConfig.customer_creation = 'always';
      sessionConfig.customer_email = user.email;
    }

    return getStripe().checkout.sessions.create(sessionConfig);
  }

  async register(userData) {
    const {
      email, password, firstName, lastName,
      phone, address, city, state, zipCode
    } = userData;

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error("User already exists");
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create the user in Prisma
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        address,
        city,
        state,
        zipCode,
      },
    });

    // 4. Create a Stripe Checkout Session
    const session = await this.createRegistrationCheckoutSession(newUser);

    return {
      user: { id: newUser.id, email: newUser.email },
      checkoutUrl: session.url,
      sessionId: session.id // Returns the session ID to the frontend
    };
  }

  async resumePayment(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Incorrect password');
    }

    if (user.role !== 'MEMBER') {
      throw new Error('Payment resume is only available for member accounts');
    }

    if (user.status === 'ACTIVE') {
      throw new Error('Payment already completed');
    }

    if (user.status !== 'PENDING_PAYMENT') {
      throw new Error(getInactiveAccountErrorCode(user.role));
    }

    const session = await this.createRegistrationCheckoutSession(user, {
      cancelUrl: `${process.env.CLIENT_URL}/login`,
    });

    return {
      user: { id: user.id, email: user.email },
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  async verifyPayment(sessionId) {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const userId = session.client_reference_id;

      // Update the user status to ACTIVE
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          stripeCustomerId: session.customer,
        },
      });

      return { success: true, user: sanitizeUser(updatedUser) };
    }

    throw new Error('Payment not completed');
  }

  async login(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("User not found");
    }

    // Compare against the 'password' field
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Incorrect password");
    }

    if (user.status === 'PENDING_PAYMENT') {
      throw new Error("PaymentRequired");
    }

    if (user.status !== 'ACTIVE') {
      throw new Error(getInactiveAccountErrorCode(user.role));
    }

    const tokens = this.generateTokens(user);

    return {
      ...tokens,
      user: sanitizeUser(user),
    };
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new Error("No refresh token provided");

    try {
      // Verify the refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Ensure user exists and is active
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) {
        throw new Error('Invalid or expired refresh token');
      }

      if (user.status !== 'ACTIVE') {
        throw new Error(getInactiveAccountErrorCode(user.role));
      }

      // Generate a new set of tokens
      const tokens = this.generateTokens(user);
      return tokens;

    } catch (error) {
      if (error.message === 'MemberAccountInactive' || error.message === 'AccountInactive') {
        throw error;
      }

      throw new Error('Invalid or expired refresh token');
    }
  }
}

export default new AuthService();