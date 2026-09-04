import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      include: { movies: { include: { movie: true }, orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  create(data: { name: string; slug: string; description?: string }) {
    return this.prisma.category.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; slug: string; description: string }>) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException();
    return this.prisma.category.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  async setMovies(categoryId: string, movieIds: string[]) {
    await this.prisma.categoryMovie.deleteMany({ where: { categoryId } });
    await this.prisma.categoryMovie.createMany({
      data: movieIds.map((movieId, order) => ({ categoryId, movieId, order })),
    });
    return this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { movies: { include: { movie: true } } },
    });
  }
}
