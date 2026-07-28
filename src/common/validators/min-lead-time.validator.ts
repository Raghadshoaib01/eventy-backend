// src/common/validators/min-lead-time.validator.ts
import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsAtLeastDaysInFuture(days: number, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAtLeastDaysInFuture',
      target: object.constructor,
      propertyName,
      options: { message: `Event date must be at least ${days} day(s) from today`, ...validationOptions },
      validator: {
        validate(value: any) {
          if (!value) return false;
          const inputDate = new Date(value);
          if (isNaN(inputDate.getTime())) return false;
          const minDate = new Date();
          minDate.setDate(minDate.getDate() + days);
          minDate.setHours(0, 0, 0, 0);
          inputDate.setHours(0, 0, 0, 0);
          return inputDate >= minDate;
        },
      },
    });
  };
}