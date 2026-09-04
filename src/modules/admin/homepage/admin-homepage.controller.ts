import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminHomepageService } from './admin-homepage.service';

@ApiTags('admin-homepage')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/homepage')
export class AdminHomepageController {
  constructor(private readonly homepageService: AdminHomepageService) {}

  @Get()
  list() {
    return this.homepageService.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.homepageService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.homepageService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.homepageService.remove(id);
  }

  @Post(':id/movies')
  setMovies(@Param('id') id: string, @Body('movieIds') movieIds: string[]) {
    return this.homepageService.setMovies(id, movieIds);
  }

  @Post('reorder')
  reorder(@Body('sections') sections: { id: string; order: number }[]) {
    return this.homepageService.reorder(sections);
  }
}
