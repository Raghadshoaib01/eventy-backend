import { BookingStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

export function formatBookingResponse(booking: any) {
  if (!booking) return booking;

  const { payment, ...rest } = booking;
  const isConfirmed = booking.status === 'CONFIRMED';

  let paymentInfo = undefined;
  if (isConfirmed && payment) {
    paymentInfo = {
      id: payment.id,
      method: payment.method,
      status: payment.status,
    };
    if (payment.method === 'CASH'&& payment.status === 'PROCESSING') {
      const pUser = booking.provider?.user;
      const svc = booking.service;
      paymentInfo['providerLocation'] = {
        latitude: pUser?.latitude ?? svc?.latitude,
        longitude: pUser?.longitude ?? svc?.longitude,
        locationName: pUser?.locationName ?? svc?.locationName,
      };
    }
  }

  return {
    ...rest,
    ...(paymentInfo ? { payment: paymentInfo } : {}),
  };
}

export function formatBookingsList(bookings: any[]) {
  if (!Array.isArray(bookings)) return bookings;
  return bookings.map(formatBookingResponse);
}
