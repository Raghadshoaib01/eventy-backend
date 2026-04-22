export const JWT_ACCESS_SECRET =
  process.env.JWT_SECRET || 'eventy-access-secret-key-2025';
export const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'eventy-refresh-secret-key-2025';

//export const JWT_ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  || '15m';  // 15 دقيقة
export const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '7d'; // develope temp
export const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d'; // أسبوع
