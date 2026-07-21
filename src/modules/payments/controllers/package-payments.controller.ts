import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PaymentsService } from '../payments.service';
import { PayPackageBookingDto } from '../dto/pay-package-booking.dto';

/**
 * Package purchase payment (docs/payments-implementation-plan.md §6.1,
 * docs/packages-implementation-plan.md §12.4). Lives under `/packages` to
 * match the documented route, even though the logic is owned by
 * PaymentsService/PaymentsModule — a package purchase's payment is not a
 * different mechanism from an ordinary one, just several created together.
 */
@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('packages')
export class PackagePaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':packageBookingId/payments')
  @ApiParam({ name: 'packageBookingId', description: 'Package booking ID' })
  @ApiOperation({ summary: 'Pay for every service in a package purchase in one action' })
  pay(@Request() req, @Param('packageBookingId') packageBookingId: string, @Body() dto: PayPackageBookingDto) {
    return this.paymentsService.payForPackageBooking(req.user.sub, packageBookingId, dto);
  }
}
