import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AttachServiceDto {
  @ApiProperty({ example: 'uuid-of-an-existing-public-service-owned-by-the-caller' })
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'false = optional add-on the customer picks at booking time (docs/packages-implementation-plan.md §2.3)',
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
