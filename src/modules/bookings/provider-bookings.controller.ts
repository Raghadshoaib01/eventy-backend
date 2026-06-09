import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProviderBookingsService } from './provider-bookings.service';

@Controller('provider-bookings')
export class ProviderBookingsController {
     constructor(
    private readonly providerBookingsService: ProviderBookingsService,
  ) {}
    @Get('recent')
    @ApiOperation({
    summary: 'Get provider recent bookings',
    })
    @ApiResponse({
    status: 200,
    description: 'Recent bookings retrieved successfully',
    })
    getProviderRecentBookings() {
    return this.providerBookingsService.getProviderRecentBookings();
    }

}
