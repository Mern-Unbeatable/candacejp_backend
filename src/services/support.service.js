import prisma from '../lib/prisma.js';
import { buildPagination } from '../utils/pagination.js';

class SupportService {
  async create(data) {
    return prisma.supportRequest.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        message: data.message,
      },
    });
  }

  async getAll(page = 1, limit = 10, status) {
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * perPage;

    const where = {};
    if (status && status.toLowerCase() !== 'all') {
      const normalizedStatus = status.toUpperCase();
      if (!['NEW', 'SOLVED'].includes(normalizedStatus)) {
        throw new Error('Invalid status filter. Use all, NEW, or SOLVED.');
      }
      where.status = normalizedStatus;
    }

    const [requests, total] = await Promise.all([
      prisma.supportRequest.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supportRequest.count({ where }),
    ]);

    return {
      supportRequests: requests,
      pagination: buildPagination(currentPage, perPage, total),
    };
  }

  async updateStatus(id, status) {
    const request = await prisma.supportRequest.findUnique({ where: { id } });
    if (!request) {
      throw new Error('Support request not found');
    }
    if (request.status === 'SOLVED') {
      throw new Error('Support request is already solved');
    }

    return prisma.supportRequest.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id) {
    const request = await prisma.supportRequest.findUnique({ where: { id } });
    if (!request) {
      throw new Error('Support request not found');
    }

    await prisma.supportRequest.delete({ where: { id } });
  }
}

export default new SupportService();
