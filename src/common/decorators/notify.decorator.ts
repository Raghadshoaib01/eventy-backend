// src/common/decorators/notify.decorator.ts

import { SetMetadata } from '@nestjs/common';
import { DomainEventName } from '../events/domain-events';

export const NOTIFY_KEY = 'notify_event';

export interface NotifyOptions {
  /** The domain event name to emit after successful execution */
  event: DomainEventName;
  /**
   * Key in the response data object to read as entityId.
   * Defaults to 'id'.
   */
  entityIdKey?: string;
}

/**
 * Mark a controller method to emit a domain event after successful execution.
 * The interceptor reads the response and constructs the event payload.
 *
 * @example
 * @Notify({ event: DomainEvents.BOOKING_CREATED, entityIdKey: 'bookingId' })
 */
export const Notify = (options: NotifyOptions) =>
  SetMetadata(NOTIFY_KEY, options);
