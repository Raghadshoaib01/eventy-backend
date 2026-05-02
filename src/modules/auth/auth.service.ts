import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ConfirmResetPasswordDto, RequestResetPasswordDto } from './dto/reset-password.dto';
import { comparePassword, hashPassword } from 'src/common/helpers/hash.helper';
import { UserRole } from 'src/shared/Enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { TokenPair } from 'src/shared/Interfaces/token-pair.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PrismaService } from 'src/database/prisma.service';
import { signAccessToken, signRefreshToken } from 'src/common/helpers/token.helper';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}
  // signup → ينشئ مستخدم ويرسل OTP
  async signup(dto: RegisterDto, profileImage?: Express.Multer.File) {
    // 1. تحقق من عدم تكرار الإيميل
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // 2. رفع الصورة إن وُجدت
    let profileImageUrl: string | null = null;
    if (profileImage) {
      const uploaded = await this.cloudinaryService.upload(profileImage, {
        folder: 'eventy/profiles',
      });
      profileImageUrl = uploaded.url;
    }

    // 2. hash الباسورد
    const passwordHash = await hashPassword(dto.password);

    // 3. إنشاء User + Customer
    await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        latitude: dto.latitude,   
        longitude:dto.longitude ,
        locationName :dto.locationName,
        passwordHash,
        profileImage: profileImageUrl,
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
    const otpCode = await this.otpService.sendOtp(dto.email);
  const isDev = process.env.NODE_ENV !== 'production';

    return {
      message:'Registration successful. Please verify your email with the OTP sent.',
      data: { email: dto.email ,
        ...(isDev && { otpCode }) 
    },
    };
  }


  // verifyOtp → يفعّل الحساب
  async verifyOtp(dto: VerifyOtpDto) {
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
      const tokens = await this.generateTokens(user.id, user.email, user.role);
      return {
      message: 'Email verified successfully',
      data: tokens,
      };
  }

  // resendOtp → يرسل كود جديد
  async resendOtp(dto: ResendOtpDto) {
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
 
    return { message: 'OTP resent successfully', data: null };
  }

// ============ LOGIN ============
  async login(dto: LoginDto): Promise<any> {
  // 1. البحث عن المستخدم
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
        // في login()
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Please continue with Google.',
      );
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
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is suspended');
    }
 
    // 4. تحديث آخر تسجيل دخول
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
 
    // 5. توليد tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role);
      return {
          message: 'Login successful',
          data: tokens,
        };
}
async googleLogin(googleUser: {
  googleId: string;
  email: string;
  fullName: string;
  profileImage?: string;
}): Promise<TokenPair> {
  // 1. هل المستخدم موجود بالإيميل؟
  let user = await this.prisma.user.findUnique({
    where: { email: googleUser.email },
  });

  if (user) {
    // ربط googleId إن لم يكن مربوطاً
    if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.googleId },
      });
    }
  } else {
    // إنشاء حساب جديد تلقائياً
    user = await this.prisma.user.create({
      data: {
        fullName: googleUser.fullName,
        email: googleUser.email,
        googleId: googleUser.googleId,
        profileImage: googleUser.profileImage,
        role: UserRole.CUSTOMER,
        emailVerified: true,      // Google يضمن التحقق
        status: 'ACTIVE',
        passwordHash: null,       // لا باسورد لمستخدم Google
        customer: { create: { loyaltyPoints: 0 } },
      },
    });
  }

  await this.prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

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
 
    return { message: 'Password changed successfully' , data: null };
  }
 
  // requestReset → نسيان الباسورد
  async requestReset(dto: RequestResetPasswordDto) {
   // 1. التحقق من وجود المستخدم
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const isDev = process.env.NODE_ENV !== 'production';
    let otp: string | null = null;
    // لأسباب أمنية نرجع نفس الرسالة سواء وُجد أم لا
  if (user) {
      otp = await this.otpService.sendOtp(dto.email);
  }
return {
    message: 'If this email exists, you will receive an OTP',
    data: isDev && otp ? { otpCode: otp } : null,
  };
  }

  // confirmReset → تأكيد + باسورد جديد
  async confirmReset(dto: ConfirmResetPasswordDto) {
      // 1. التحقق من OTP
    await this.otpService.verifyOtp(dto.email, dto.code);

      // 2. hash الباسورد الجديد
    const newHash = await hashPassword(dto.newPassword);
 
    // 3. تحديث في DB
    await this.prisma.user.update({
      where: { email: dto.email },
      data: { passwordHash: newHash },
    });
 
  return { message: 'Password reset successfully', data: null };
  }

  // refreshToken
async refreshToken(token: string) {
  // 1. ابحث عن التوكن في DB
  const stored = await this.prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!stored) throw new UnauthorizedException('Invalid refresh token');

  // 2. تحقق من انتهاء الصلاحية
  if (stored.expiresAt < new Date()) {
    await this.prisma.refreshToken.delete({ where: { token } });
    throw new UnauthorizedException('Refresh token expired');
  }

  // 3. احذف القديم (rotation)
  await this.prisma.refreshToken.delete({ where: { token } });

  // 4. أنشئ توكنات جديدة
  const tokens = await this.generateTokens(
    stored.user.id,
    stored.user.email,
    stored.user.role,
  );

  return {
    message: 'Token refreshed successfully',
    data: tokens,
  };
}

// logout
async logout(refreshToken: string) {
  // احذف التوكن من DB — إن لم يوجد لا تُرجع خطأ
  await this.prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });

  return { message: 'Logged out successfully', data: null };
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
