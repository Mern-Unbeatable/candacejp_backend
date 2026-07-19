import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

// Helper function to handle name splitting
function parseName(data) {
  // If firstName/lastName are explicitly provided, use them
  if (data.firstName || data.lastName) {
    return {
      firstName: data.firstName?.trim() || null,
      lastName: data.lastName?.trim() || null
    };
  }

  // If fullName is provided, split it
  if (data.fullName) {
    const trimmed = data.fullName.trim();
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex === -1) return { firstName: trimmed, lastName: null };

    return {
      firstName: trimmed.slice(0, spaceIndex),
      lastName: trimmed.slice(spaceIndex + 1).trim()
    };
  }

  return {}; // Return empty if no name fields provided
}

class UserService {
  async getProfileById(id) {
    return await prisma.user.findUnique({
      where: { id },
      omit: { password: true, stripeCustomerId: true }
    });
  }

  async updateProfile(id, data) {
    // Process the name fields before passing to prisma
    const nameData = parseName(data);
    const name = [nameData.firstName, nameData.lastName]
      .filter(Boolean)
      .join(' ');

    return await prisma.user.update({
      where: { id },
      data: {
        ...nameData,
        ...(name ? { name } : {}),
        email: data.email,
        phone: data.phone,
        address: data.address,
        zipCode: data.zipCode,
        city: data.city,
        state: data.state,
      },
      omit: { password: true }
    });
  }

  async updatePassword(id, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new Error('User not found');
    }

    const account = await prisma.account.findUnique({
      where: {
        providerId_accountId: {
          providerId: 'credential',
          accountId: id,
        },
      },
    });

    const isMatch = account?.password
      ? await bcrypt.compare(currentPassword, account.password)
      : false;
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    const [, updatedUser] = await prisma.$transaction([
      prisma.account.upsert({
        where: {
          providerId_accountId: {
            providerId: 'credential',
            accountId: id,
          },
        },
        create: {
          providerId: 'credential',
          accountId: id,
          userId: id,
          password: hashedPassword,
        },
        update: { password: hashedPassword },
      }),
      prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
        omit: { password: true },
      }),
      // Revoke stolen/old bearer sessions after a password change.
      prisma.session.deleteMany({
        where: { userId: id },
      }),
    ]);

    return updatedUser;
  }
}
export default new UserService();