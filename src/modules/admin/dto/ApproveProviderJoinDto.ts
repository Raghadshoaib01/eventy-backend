import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsArray, IsUUID } from 'class-validator';

// DTO for approving or rejecting a new service provider join request
export class ApproveProviderJoinDto {
  @ApiProperty({ 
    example: 'uuid-of-provider',
    description: 'Service Provider ID'
  })
  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({ 
    example: 'uuid-of-service',
    description: 'Primary Service ID'
  })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ 
    example: true,
    description: 'true for acceptance, false for rejection'
  })
  @IsBoolean()
  @IsNotEmpty()
  isApproved: boolean;

  @ApiProperty({ 
    example: 'Please update your license information.',
    required: false,
    description: 'Optional administrative letter (reason for rejection or comments)'
  })
  @IsString()
  @IsOptional()
  adminMessage?: string;
}

// DTO for approving or rejecting a new service
export class ApproveServiceDto {
  @ApiProperty({ 
    example: 'uuid-of-service',
    description: 'Service ID'
  })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ 
    example: true,
    description: 'true for acceptance, false for rejection'
  })
  @IsBoolean()
  @IsNotEmpty()
  isApproved: boolean;

  @ApiProperty({ 
    example: ['uuid-sub1', 'uuid-sub2'],
    required: false,
    description: 'Accepted sub-service IDs'
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  approvedSubServiceIds?: string[];

  @ApiProperty({
    example: ['uuid-sub3', 'uuid-sub4'],
    required: false,
    description: 'Rejected sub-service IDs'
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  rejectedSubServiceIds?: string[];

  @ApiProperty({
    example: 'Please improve the image quality.',
    required: false,
    description: 'Optional administrative message'
  })
  @IsString()
  @IsOptional()
  adminMessage?: string;
}

// DTO for approving or rejecting a new sub-service
export class ApproveSubServiceDto {
  @ApiProperty({
    example: 'uuid-of-subservice',
    description: 'Sub-service ID'
  })
  @IsUUID()
  @IsNotEmpty()
  subServiceId: string;

  @ApiProperty({
    example: true,
    description: 'true to approve, false to reject'
  })
  @IsBoolean()
  @IsNotEmpty()
  isApproved: boolean;

  @ApiProperty({
    example: 'The pricing is not appropriate.',
    required: false,
    description: 'Optional administrative message'
  })
  @IsString()
  @IsOptional()
  adminMessage?: string;
}

// DTO for approving or rejecting a submitted package
// (docs/packages-implementation-plan.md §5.4)
export class ApprovePackageDto {
  @ApiProperty({
    example: 'uuid-of-package',
    description: 'Package ID'
  })
  @IsUUID()
  @IsNotEmpty()
  packageId: string;

  @ApiProperty({
    example: true,
    description: 'true for acceptance, false for rejection'
  })
  @IsBoolean()
  @IsNotEmpty()
  isApproved: boolean;

  @ApiProperty({
    example: 'Great combination, approved.',
    required: false,
    description: 'Optional administrative message'
  })
  @IsString()
  @IsOptional()
  adminMessage?: string;
}
