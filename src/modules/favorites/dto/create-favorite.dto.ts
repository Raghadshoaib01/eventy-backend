import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { FavoriteTargetType } from '@prisma/client';

export class CreateFavoriteDto {
  @ApiProperty({ enum: FavoriteTargetType, example: FavoriteTargetType.SERVICE })
  @IsEnum(FavoriteTargetType)
  targetType: FavoriteTargetType;

  @ApiProperty({ example: 'uuid-of-the-service-provider-or-package' })
  @IsUUID()
  targetId: string;
}
