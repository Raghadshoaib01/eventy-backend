import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { FavoriteTargetType } from '@prisma/client';
import { FavoritesService } from '../favorites.service';
import { CreateFavoriteDto } from '../dto/create-favorite.dto';
import { FavoritesQueryDto } from '../dto/favorites-query.dto';

/**
 * Customer-facing Favorites API (docs/favorites-implementation-plan.md §3).
 */
@ApiTags('Favorites')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Favorite a service, provider, or package' })
  create(@Request() req, @Body() dto: CreateFavoriteDto) {
    return this.favoritesService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my favorites, optionally filtered by targetType' })
  list(@Request() req, @Query() query: FavoritesQueryDto) {
    return this.favoritesService.list(req.user.sub, query);
  }

  @Get('status')
  @ApiQuery({ name: 'targetType', enum: FavoriteTargetType })
  @ApiQuery({ name: 'targetId' })
  @ApiOperation({ summary: 'Quick check for a detail page\'s heart-icon state' })
  status(
    @Request() req,
    @Query('targetType', new ParseEnumPipe(FavoriteTargetType)) targetType: FavoriteTargetType,
    @Query('targetId') targetId: string,
  ) {
    return this.favoritesService.status(req.user.sub, targetType, targetId);
  }

  @Delete(':targetType/:targetId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'targetType', enum: FavoriteTargetType })
  @ApiParam({ name: 'targetId' })
  @ApiOperation({ summary: 'Unfavorite' })
  remove(
    @Request() req,
    @Param('targetType', new ParseEnumPipe(FavoriteTargetType)) targetType: FavoriteTargetType,
    @Param('targetId') targetId: string,
  ) {
    return this.favoritesService.remove(req.user.sub, targetType, targetId);
  }
}
