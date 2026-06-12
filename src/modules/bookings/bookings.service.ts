import { Injectable } from '@nestjs/common';

@Injectable()
export class BookingsService {

    async confirmQuote(
  bookingId: string,
) {
  // TODO: Confirm provider quote and update booking status
  return {
    message: 'Confirm quote is not implemented yet',
  };
}


async rejectQuote(
  bookingId: string,
) {
  // TODO: Reject provider quote and update booking status
  return {
    message: 'Reject quote is not implemented yet',
  };
}
}
