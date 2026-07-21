import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePackageDto {
  @ApiPropertyOptional({ example: 'Grand Wedding Bundle' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Hall + catering + photography, booked together.' })
  @IsOptional()
  @IsString()
  description?: string;
}
