import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const ACCEPT_PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH'] as const;
export type BulkQuotePaymentMethod = (typeof ACCEPT_PAYMENT_METHODS)[number];

@ValidatorConstraint({ name: 'atLeastOneBookingId', async: false })
class AtLeastOneBookingIdConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as BulkQuoteDecisionDto;
    const accepted = obj.acceptedBookingIds?.length ?? 0;
    const rejected = obj.rejectedBookingIds?.length ?? 0;
    return accepted + rejected > 0;
  }

  defaultMessage() {
    return 'At least one booking ID must be provided in acceptedBookingIds or rejectedBookingIds';
  }
}

export class BulkQuoteDecisionDto {
  @ApiProperty({
    example: 'uuid-of-event',
    description: 'Event the bookings belong to',
  })
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['uuid-booking-1', 'uuid-booking-2'],
    description: 'Booking IDs whose quotes the customer accepts',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  acceptedBookingIds?: string[];

  @ApiPropertyOptional({
    enum: ACCEPT_PAYMENT_METHODS,
    example: 'BANK_TRANSFER',
    description: 'Required when acceptedBookingIds contains at least one item',
  })
  @ValidateIf((o: BulkQuoteDecisionDto) => (o.acceptedBookingIds?.length ?? 0) > 0)
  @IsNotEmpty({ message: 'method is required when accepting at least one booking' })
  @IsIn(ACCEPT_PAYMENT_METHODS)
  method?: BulkQuotePaymentMethod;

  @ApiPropertyOptional({
    type: [String],
    example: ['uuid-booking-3'],
    description: 'Booking IDs whose quotes the customer rejects',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  rejectedBookingIds?: string[];

  @ApiPropertyOptional({
    example: 'Found a better price elsewhere.',
    description: 'Optional reason included in provider rejection notifications',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;

  @Validate(AtLeastOneBookingIdConstraint)
  private readonly _atLeastOneBookingId?: never;
}
