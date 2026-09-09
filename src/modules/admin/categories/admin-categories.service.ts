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

  async seedDefaults() {
    const defaultCategories = [
      { name: '🔥 Trending Now', slug: 'trending', description: 'Top trending movies this week' },
      { name: '💥 Action & Blockbusters', slug: 'action', description: 'High-octane action and blockbuster movies' },
      { name: '🚀 Sci-Fi & Mind Bending', slug: 'sci-fi', description: 'Futuristic, space and mind-bending science fiction' },
      { name: '🎭 Drama & Stories', slug: 'drama', description: 'Gripping dramas and emotional stories' },
      { name: '😂 Comedy & Laughs', slug: 'comedy', description: 'Side-splitting comedies for family and friends' },
      { name: '🔍 Crime & Mystery', slug: 'crime', description: 'Thrilling crime investigations and mystery thrillers' },
      { name: '🌟 UrduBox Exclusives', slug: 'urdubox', description: 'Exclusive Pakistani and Urdu dubbed releases' },
      { name: '🎬 Hindi Dubbed', slug: 'hindi-dubbed', description: 'Popular international movies dubbed in Hindi' },
      { name: '🍿 Hollywood Masterpieces', slug: 'hollywood', description: 'Critically acclaimed Hollywood masterworks' },
    ];

    const results = [];
    for (const cat of defaultCategories) {
      const existing = await this.prisma.category.findUnique({ where: { slug: cat.slug } });
      if (!existing) {
        const created = await this.prisma.category.create({ data: cat });
        results.push(created);
      } else {
        results.push(existing);
      }
    }
    return this.list();
  }
}
