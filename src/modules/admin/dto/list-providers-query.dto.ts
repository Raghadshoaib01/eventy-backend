import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export enum ProviderListStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

export class ListProvidersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ProviderListStatus,
    description:
      'Filter providers by status. "pending"/"approved"/"rejected" map to the approval ' +
      'workflow (ServiceProvider.approvalStatus); "active"/"blocked" map to the account ' +
      'state (User.status) of an already-approved provider. Omit to return all providers.',
  })
  @IsOptional()
  @IsEnum(ProviderListStatus)
  status?: ProviderListStatus;
}
