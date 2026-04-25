// src/common/validators/password.validator.ts
import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsStrongPassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'Password must be 8+ characters with uppercase, lowercase, number, and special character',
        ...options,
      },
      validator: {
        validate(value: string) {
          if (typeof value !== 'string') return false;
          const hasMin8       = value.length >= 8;
          const hasUppercase  = /[A-Z]/.test(value);
          const hasLowercase  = /[a-z]/.test(value);
          const hasNumber     = /[0-9]/.test(value);
          const hasSpecial    = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
          return hasMin8 && hasUppercase && hasLowercase && hasNumber && hasSpecial;
        },
      },
    });
  };
}