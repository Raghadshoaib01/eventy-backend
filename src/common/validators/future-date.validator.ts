import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsTodayOrFuture(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isTodayOrFuture',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value) return false;

          const inputDate = new Date(value);
          if (isNaN(inputDate.getTime())) return false;
        
          // مقارنة التاريخ فقط بدون الوقت
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          inputDate.setHours(0, 0, 0, 0);

          return inputDate >= today;
           }, 
          defaultMessage(args: ValidationArguments) {
          return `${args.property} must be today or a future date`;
        },
      },
    });
  };
}