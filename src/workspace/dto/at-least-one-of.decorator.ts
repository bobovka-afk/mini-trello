import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Хотя бы одно из перечисленных полей должно быть передано в теле запроса.
 */
export function AtLeastOneOf(
  fields: string[],
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'atLeastOneOf',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          return fields.some((f) => obj[f] !== undefined);
        },
        defaultMessage() {
          return (
            (typeof validationOptions?.message === 'string' &&
              validationOptions.message) ||
            `Укажите хотя бы одно из полей: ${fields.join(', ')}`
          );
        },
      },
    });
  };
}
