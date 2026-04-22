import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ConfirmResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
  ) {}
  // signup → ينشئ مستخدم ويرسل OTP
  async signup(dto: RegisterDto) {
    // 1. تحقق ما في إيميل مكرر
    // 2. hash الباسورد
    // 3. create User في Prisma (isVerified: false)
    // 4. this.otpService.sendOtp(dto.email)
    // 1. تحقق من عدم تكرار الإيميل
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // 2. hash الباسورد
    const passwordHash = await hashPassword(dto.password);

    // 3. إنشاء User + Customer
    await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
        passwordHash,
        role: UserRole.CUSTOMER,
        emailVerified: false,
        customer: {
          create: {
            loyaltyPoints: 0,
          },
        },
      },
    });

    // 4. إرسال OTP
    await this.otpService.sendOtp(dto.email);

    return {
      message:
        'Registration successful. Please verify your email with the OTP sent.',
    };
  }


  // verifyOtp → يفعّل الحساب
  async verifyOtp(dto: VerifyOtpDto) {
    // 1. this.otpService.verifyOtp(email, code)
    // 2. update User: isVerified = true
    // 3. return generateTokens(user)
    // 1. التحقق من الكود
    await this.otpService.verifyOtp(dto.email, dto.code);

    // 2. تفعيل الحساب
    const user = await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
      },
    });

    // 3. توليد tokens
    return this.generateTokens(user.id, user.email, user.role);
  }

  // resendOtp → يرسل كود جديد
  async resendOtp(dto: ResendOtpDto) {
    // 1. this.otpService.deleteOtp(email)   ← يمسح القديم
    // 2. this.otpService.sendOtp(email)     ← يرسل جديد
     // 1. التحقق من وجود المستخدم
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
 
    // 2. حذف الكود القديم
    await this.otpService.deleteOtp(dto.email);
 
    // 3. إرسال كود جديد
    await this.otpService.sendOtp(dto.email);
 
    return { message: 'OTP resent successfully' };
  }

// ============ LOGIN ============
  async login(dto: LoginDto): Promise<TokenPair> {
  // 1. البحث عن المستخدم
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
 
    // 2. التحقق من الباسورد
    const isValid = await comparePassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
 
    // 3. التحقق من تفعيل الحساب
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }
 
    // 4. تحديث آخر تسجيل دخول
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
 
    // 5. توليد tokens
    return this.generateTokens(user.id, user.email, user.role);

}

// ============ CHANGE PASSWORD ============
  async changePassword(userId: string, dto: ChangePasswordDto) {
    // 1. جلب المستخدم
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('User not found');
    }
 
    // 2. التحقق من الباسورد القديم
    const isValid = await comparePassword(dto.oldPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Old password is incorrect');
    }
 
    // 3. hash الباسورد الجديد
    const newHash = await hashPassword(dto.newPassword);
 
    // 4. تحديث في DB
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
 
    return { message: 'Password changed successfully' };
  }
 
  // requestReset → نسيان الباسورد
  async requestReset(email: string) {
    // 1. تحقق المستخدم موجود
    // 2. this.otpService.sendOtp(email)
   // 1. التحقق من وجود المستخدم
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
  
      throw new NotFoundException( 'User not found');
    }
 
    // 2. إرسال OTP
    await this.otpService.sendOtp(dto.email);
 
    return { message: 'If this email exists, you will receive an OTP' };
  }

  // confirmReset → تأكيد + باسورد جديد
  async confirmReset(dto: ConfirmResetPasswordDto) {
    // 1. this.otpService.verifyOtp(email, code)
    // 2. hash newPassword
    // 3. update User في Prisma
      // 1. التحقق من OTP
    const cheackVerify= await this.otpService.verifyOtp(dto.email, dto.code);
 if (!cheackVerify) {
  
      throw new NotFoundException( 'otp not correct');
    }    // 2. hash الباسورد الجديد
    const newHash = await hashPassword(dto.newPassword);
 
    // 3. تحديث في DB
    await this.prisma.user.update({
      where: { email: dto.email },
      data: { passwordHash: newHash },
    });
 
    return { message: 'Password reset successfully' };
  
  }

    // ============ HELPER: Generate Tokens ============
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<TokenPair> {
    const payload = { sub: userId, email, role };
 
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
 
    // حفظ refresh token في DB
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 أيام
      },
    });
 
    return { accessToken, refreshToken };
  }
}
