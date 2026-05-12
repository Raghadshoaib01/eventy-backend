import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * @example
 * @Roles('admin') 
 * @Roles('admin', 'employee')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);