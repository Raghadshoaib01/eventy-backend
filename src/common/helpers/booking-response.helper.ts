import { BookingStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

export function formatBookingResponse(booking: any) {
  if (!booking) return booking;

  const { payment, discount, ...rest } = booking;
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
  let discountInfo = undefined;
if (booking.discountId) {
    discountInfo = {
      id: booking.discountId,
      code: discount?.code ?? null,
      percentOff: discount?.percentOff,
      amount: booking.discountAmount,
    };
  }

  return {
    ...rest,
    ...(discountInfo ? { discount: discountInfo } : {}),
    ...(paymentInfo ? { payment: paymentInfo } : {}),
  };
}

export function formatBookingsList(bookings: any[]) {
  if (!Array.isArray(bookings)) return bookings;
  return bookings.map(formatBookingResponse);
}
