import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import prisma from '../lib/prisma.js';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key);
}

class AuthService {
  // Helper method to generate both access and refresh tokens
  generateTokens(user) {
    const payload = { id: user.id, role: user.role, status: user.status };
    
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { 
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' 
    });
    
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' 
    });

    return { accessToken, refreshToken };
  }

  async register(userData) {
    const { email, password, firstName, lastName } = userData;

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error("User already exists");
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create the user in Prisma (Uses the new 'password' field)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword, // Updated field name
        firstName,
        lastName,
      },
    });

    // 4. Create a Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Raven Membership Registration',
              description: 'One-time registration fee for the Raven platform.',
            },
            unit_amount: 19900, // $199.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      client_reference_id: newUser.id, 
      customer_email: newUser.email,
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/register`,
    });

    return {
      user: { id: newUser.id, email: newUser.email },
      checkoutUrl: session.url,
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

      return { success: true, user: updatedUser };
    }

    throw new Error("Payment not completed");
  }

  async login(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Compare against the new 'password' field
    const isMatch = await bcrypt.compare(password, user.password); // Updated field name
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    if (user.status === 'PENDING_PAYMENT') {
      throw new Error("PaymentRequired");
    }

    const tokens = this.generateTokens(user);

    return {
      ...tokens,
      user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role }
    };
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new Error("No refresh token provided");

    try {
      // Verify the refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Ensure user exists and is active
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user || user.status !== 'ACTIVE') {
        throw new Error("User account is no longer active");
      }

      // Generate a new set of tokens
      const tokens = this.generateTokens(user);
      return tokens;

    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }
}

export default new AuthService();