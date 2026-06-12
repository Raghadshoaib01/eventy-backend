import { Injectable } from '@nestjs/common';

@Injectable()
export class EventService {

    async createEvent(body: any) {
  // TODO: Create new event and associate it with customer/provider services
  return {
    message: 'Create event is not implemented yet',
  };
}

async getEventBookings(
  eventId: string,
) {
  // TODO: Get all bookings related to specific event
  return {
    message: 'Get event bookings is not implemented yet',
  };
}
}


