import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { generateOtpCode } from 'src/common/helpers/otp.helper';
import {
  REDIS_OTP_PREFIX,
  OTP_TTL_SECONDS,
} from 'src/common/constants/redis.constants';

@Injectable()
export class OtpService {
  constructor(
    @Inject(CACHE_MANAGER)
    private cache: Cache,
  ) {}

  /**
   * يُستدعى من: auth.service → signup(), requestReset()
   * يولّد كود OTP ويحفظه في Redis
   */
  async sendOtp(email: string): Promise<string> {
    const code = generateOtpCode();
    const key = `${REDIS_OTP_PREFIX}${email}`;

    // حفظ في Redis مع TTL تلقائي
    await this.cache.set(key, code, OTP_TTL_SECONDS * 1000); // بالميلي ثانية

    // TODO: إرسال الإيميل الفعلي
    console.log(`📧 OTP sent to ${email}: ${code}`);
      return code; // ← نرجع الكود

  }

  /**
   * يُستدعى من: auth.service → verifyOtp(), confirmReset()
   * يتحقق من صحة الكود ويحذفه بعد الاستخدام
   */
  async verifyOtp(email: string, code: string): Promise<boolean> {
    const key = `${REDIS_OTP_PREFIX}${email}`;
    const stored = await this.cache.get<string>(key);

    if (!stored) {
      throw new BadRequestException('OTP expired or not found');
    }

    if (stored !== code) {
      throw new BadRequestException('Invalid OTP code');
    }

    // حذف الكود بعد التحقق الناجح (one-time use)
    await this.cache.del(key);
    return true;
  }

  /**
   * يُستدعى من: auth.service → resendOtp()
   * يحذف الكود القديم قبل إرسال واحد جديد
   */
  async deleteOtp(email: string): Promise<void> {
    const key = `${REDIS_OTP_PREFIX}${email}`;
    await this.cache.del(key);
  }
}
