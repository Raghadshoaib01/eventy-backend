import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export enum UserListStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  PENDING = 'pending',
}

export class ListUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: UserListStatus,
    description: 'Filter customers by account status. Omit to return all statuses.',
  })
  @IsOptional()
  @IsEnum(UserListStatus)
  status?: UserListStatus;
}
