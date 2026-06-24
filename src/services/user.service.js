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
      omit: { password: true }
    });
  }

  async updateProfile(id, data) {
    // Process the name fields before passing to prisma
    const nameData = parseName(data);
    
    return await prisma.user.update({
      where: { id },
      data: {
        ...nameData,
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

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    return await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      omit: { password: true },
    });
  }
}
export default new UserService();