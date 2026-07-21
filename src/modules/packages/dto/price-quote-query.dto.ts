import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PriceQuoteQueryDto {
  @ApiPropertyOptional({ example: 150, description: 'Required for GUEST_BASED packages (docs §10, §11)' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'IDs of the optional (isRequired=false) items the customer selected',
    example: ['uuid-1', 'uuid-2'],
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return [];
    return Array.isArray(value) ? value : String(value).split(',').map((v) => v.trim()).filter(Boolean);
  })
  @IsArray()
  @IsUUID('4', { each: true })
  optionalServiceIds?: string[] = [];

  @ApiPropertyOptional({ example: 'WEDDING10', description: 'Coupon code for a code-based package discount' })
  @IsOptional()
  @IsString()
  discountCode?: string;
}
