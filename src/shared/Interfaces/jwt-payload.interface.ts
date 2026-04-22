export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string; // 'CUSTOMER' | 'PROVIDER' | 'ADMIN'
}
