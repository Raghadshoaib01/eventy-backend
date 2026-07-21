import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FavoriteTargetType } from '@prisma/client';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export class FavoritesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FavoriteTargetType })
  @IsOptional()
  @IsEnum(FavoriteTargetType)
  targetType?: FavoriteTargetType;
}
