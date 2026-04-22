import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * تحويل الباسورد العادي → hash
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * مقارنة الباسورد المدخل مع الـ hash المحفوظ
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
