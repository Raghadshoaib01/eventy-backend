import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // read metadata from handler or controller
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // إذا ما في roles محددة => مسموح
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // تأكدي أنه الـ JwtGuard نفّذ قبل الـ RolesGuard حتى يكون request.user موجود
    if (!user) throw new ForbiddenException('User not authenticated');

    // نفّذ المطابقة
    if (requiredRoles.includes(user.role)) return true;

    throw new ForbiddenException('Insufficient role');
  }
}