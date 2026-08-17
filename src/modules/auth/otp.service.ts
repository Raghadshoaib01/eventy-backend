import { BadRequestException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { generateOtpCode } from 'src/common/helpers/otp.helper';
import {
  REDIS_OTP_PREFIX,
  OTP_TTL_SECONDS,
} from 'src/common/constants/redis.constants';
import { BrevoClient } from '@getbrevo/brevo'; // الاستيراد الحديث للعميل
@Injectable()
export class OtpService  {
  
private brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY || '',
  });
  
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

try {
      await this.brevo.transactionalEmails.sendTransacEmail({
        subject: 'Your Verification Code',
htmlContent: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 40px 20px; background-color: #f4f6f8; border-radius: 12px; max-width: 480px; margin: auto; border: 1px solid #e2e8f0;">
  <h2 style="color: #1a202c; font-size: 24px; margin-bottom: 12px;">Verification Code</h2>
  <p style="color: #4a5568; font-size: 16px; margin-bottom: 24px;">Please use the following code to complete your verification:</p>
  <div style="font-size: 26px; font-weight: 700; color: #5b296d; background-color: #ffffff; padding: 12px 24px; display: inline-block; border-radius: 6px; letter-spacing: 3px; border: 1px dashed #cbd5e1;">
    ${code}
  </div>
  <p style="color: #94a3b8; font-size: 13px; margin-top: 30px;">If you didn't request this, please ignore this email.</p>
</div>`,
        sender: { 
          name: 'EVENTY', 
          email: 'eventyteam2026@gmail.com'
        },
        to: [{ email: email }],
      });

      console.log(`📧 Real OTP sent successfully via Brevo to ${email}`);        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Failed to send real email to ${email}. Falling back to mock.`, errorMessage);
        console.log(`📧 [Mock] OTP for ${email}: ${code}`);
          }
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
