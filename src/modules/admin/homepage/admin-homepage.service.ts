import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminHomepageService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.homepageSection.findMany({
      orderBy: { order: 'asc' },
      include: { movies: { include: { movie: true }, orderBy: { order: 'asc' } } },
    });
  }

  create(data: { title: string; type: string; order?: number; mode?: 'AUTO' | 'MANUAL'; config?: object }) {
    return this.prisma.homepageSection.create({ data });
  }

  async update(id: string, data: Partial<{ title: string; type: string; order: number; isActive: boolean; mode: 'AUTO' | 'MANUAL'; config: object }>) {
    const section = await this.prisma.homepageSection.findUnique({ where: { id } });
    if (!section) throw new NotFoundException();
    return this.prisma.homepageSection.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.homepageSection.delete({ where: { id } });
  }

  async setMovies(sectionId: string, movieIds: string[]) {
    await this.prisma.homepageSectionMovie.deleteMany({ where: { sectionId } });
    await this.prisma.homepageSectionMovie.createMany({
      data: movieIds.map((movieId, order) => ({ sectionId, movieId, order })),
    });
    return this.prisma.homepageSection.findUnique({
      where: { id: sectionId },
      include: { movies: { include: { movie: true } } },
    });
  }

  async reorder(sections: { id: string; order: number }[]) {
    await Promise.all(
      sections.map((s) => this.prisma.homepageSection.update({ where: { id: s.id }, data: { order: s.order } })),
    );
    return this.list();
  }
}
