// src/modules/packages/dto/book-package.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '@prisma/client';
import { IsTodayOrFuture } from 'src/common/validators/future-date.validator';

/**
 * Customer request to book an entire exclusive package
 * (docs/implementation_plan.md §3, customer endpoint
 * `POST /api/v1/packages/exclusive/:id/book`).
 *
 * A new Event is created in DRAFT status and a PackageEventBooking in
 * PENDING — per implementation_plan.md §6 (Option A: keep DRAFT, no new
 * PENDING status on Event).
 */
export class BookPackageDto {
  @ApiProperty({ example: "Sarah's Wedding" })
  @IsString()
  name: string;

  @ApiProperty({ enum: EventType, example: EventType.WEDDING })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({ example: '2026-08-15T00:00:00Z' })
  @IsDateString()
  @IsTodayOrFuture({ message: 'Event date cannot be in the past' })
  eventDate: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  eventStartTime: string;

  @ApiProperty({ example: '23:00' })
  @IsString()
  eventEndTime: string;

  @ApiPropertyOptional({ example: 'Amman, Jordan' })
  @IsOptional()
  @IsString()
  eventLocation?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfGuests?: number;

  @ApiPropertyOptional({ example: 'Arabic cuisine preferred.' })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiPropertyOptional({
    example: 'PROMO10',
    description: 'Optional PACKAGE-scope discount code',
  })
  @IsOptional()
  @IsString()
  discountCode?: string;
}
