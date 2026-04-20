// هذا الملف هو القلب — كل تعامل مع OTP يمر منه

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { generateOtpCode } from "src/common/helpers/otp.helper";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { OTP_TTL_SECONDS, REDIS_OTP_PREFIX } from "src/common/constants/redis.constants";
@Injectable()
export class OtpService {

  constructor(
    @Inject(CACHE_MANAGER)
    private cache: Cache          // من @nestjs/cache-manager
  ) {}

  // يُستدعى من: auth.service → signup(), requestReset()
  async sendOtp(email: string): Promise<void> {
    const code = generateOtpCode();
    const key  = `${REDIS_OTP_PREFIX}${email}`;   // 'otp:sarah@email.com'

    await this.cache.set(key, code, OTP_TTL_SECONDS);
    // TODO: await this.emailService.sendOtpEmail(email, code);
  }

  // يُستدعى من: auth.service → verifyOtp(), confirmReset()
  async verifyOtp(email: string, code: string): Promise<boolean> {
    const key     = `${REDIS_OTP_PREFIX}${email}`;
    const stored  = await this.cache.get<string>(key);

    if (!stored)        throw new BadRequestException('OTP expired or not found');
    if (stored !== code) throw new BadRequestException('Invalid OTP');

    await this.cache.del(key);   // يحذف بعد نجاح التحقق مرة واحدة فقط
    return true;
  }

  // يُستدعى من: auth.service → resendOtp()
  async deleteOtp(email: string): Promise<void> {
    await this.cache.del(`${REDIS_OTP_PREFIX}${email}`);
  }
}