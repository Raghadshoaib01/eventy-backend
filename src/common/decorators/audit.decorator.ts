// src/common/decorators/audit.decorator.ts

import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

export const AUDIT_KEY = 'audit_action';

export interface AuditOptions {
  /** The audit action type to log */
  action: AuditAction;
  /** The entity type being audited */
  entity: string;
  /**
   * Key in the response data object to read as entityId.
   * Defaults to 'id'.
   */
  entityIdKey?: string;
}

/**
 * Mark a controller method to create an AuditLog entry after execution.
 * Works alongside ActionTrackingInterceptor.
 *
 * @example
 * @Audit({ action: AuditAction.APPROVE, entity: 'ServiceProvider', entityIdKey: 'providerId' })
 */
export const Audit = (options: AuditOptions) =>
  SetMetadata(AUDIT_KEY, options);
