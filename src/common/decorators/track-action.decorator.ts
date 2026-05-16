// src/common/decorators/track-action.decorator.ts

import { SetMetadata } from '@nestjs/common';
import { DomainEventName } from '../events/domain-events';
import { AuditAction } from '@prisma/client';

export const TRACK_ACTION_KEY = 'track_action';

export interface TrackActionOptions {
  /** The AuditLog action type */
  action: AuditAction;
  /** The entity being acted upon (e.g. 'Booking', 'ServiceProvider') */
  entity: string;
  /** If true, an audit log entry will be persisted */
  audit?: boolean;
  /** If set, this domain event will be emitted after successful execution */
  notify?: DomainEventName;
  /** Key path in the controller response data to extract entityId from */
  entityIdPath?: string;
}

/**
 * Attach action tracking metadata to a controller method.
 * Consumed by ActionTrackingInterceptor.
 *
 * @example
 * @TrackAction({ action: AuditAction.BOOKING_CREATE, entity: 'Booking', audit: true, notify: DomainEvents.BOOKING_CREATED })
 */
export const TrackAction = (options: TrackActionOptions) =>
  SetMetadata(TRACK_ACTION_KEY, options);
