import { Injectable } from '@nestjs/common';

@Injectable()
export class ProviderBookingsService {

    async getProviderRecentBookings() {
  return {
    message: 'Get provider recent bookings is not implemented yet',
  };
}
}
