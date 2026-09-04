import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminBannersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.banner.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(data: {
    title: string;
    subtitle?: string;
    imageUrl: string;
    buttonText?: string;
    buttonUrl?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  }) {
    return this.prisma.banner.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async update(id: string, data: Partial<{
    title: string;
    subtitle: string;
    imageUrl: string;
    buttonText: string;
    buttonUrl: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }>) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException();
    return this.prisma.banner.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  remove(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }
}
