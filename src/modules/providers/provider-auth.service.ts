import { 
  BadRequestException, 
  ConflictException, 
  Injectable, 
  UnauthorizedException 
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import { OtpService } from '../auth/otp.service';
import { RegisterProviderDto } from './dto/register-provider.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { hashPassword, comparePassword } from 'src/common/helpers/hash.helper';
import { UserRole } from 'src/shared/Enums/role.enum';
import { signAccessToken, signRefreshToken } from 'src/common/helpers/token.helper';

@Injectable()
export class ProviderAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly otpService: OtpService,
  ) {}

  /**
   * تسجيل مزود خدمة جديد
   * المنطق:
   * 1. إنشاء حساب User + ServiceProvider
   * 2. إنشاء Service أولية (بدون تفاصيل كاملة)
   * 3. إرسال OTP
   * 4. بعد التحقق → ينتظر قبول Admin
   * 5. بعد القبول:
   *    - HALL/SOUND: يكمل التفاصيل مباشرة
   *    - غيرها: يكمل التفاصيل ثم يضيف SubServices
   */
  async registerProvider(
    dto: RegisterProviderDto,
    profileImage?: Express.Multer.File,
  ) {
    // 1. التحقق من عدم تكرار الإيميل
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

    // 3. Hash الباسورد
    const passwordHash = await hashPassword(dto.password);

    // 4. تحديد إذا كانت الخدمة HALL/SOUND (تحتاج price مباشرة)
    const isHallOrSound = ['HALL', 'SOUND'].includes(dto.serviceType);

    // 5. إنشاء User + ServiceProvider + Service (خدمة أولية)
    await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        passwordHash,
        profileImage: profileImageUrl,
        role: UserRole.PROVIDER,
        emailVerified: false,
        status: 'PENDING',

        // إنشاء ServiceProvider
        provider: {
          create: {
            businessName: dto.businessName,
            businessLicense: dto.businessLicense,
            locationName: dto.locationName,
            latitude: dto.latitude,
            longitude: dto.longitude,
            approvalStatus: 'PENDING',

            // إنشاء Service (خدمة أولية - بدون تفاصيل)
            services: {
              create: {
                serviceType: dto.serviceType as any,
                eventTypes: dto.eventTypes as any[],
                description: dto.description,
                isCompleted: false, // سيتم إكمالها بعد القبول
                approvalStatus: 'PENDING',
                
                // For HALL/SOUND: نحفظ القيم الأولية
                minCapacity: isHallOrSound ? dto.minCapacity : null,
                maxCapacity: isHallOrSound ? dto.maxCapacity : null,
                price: isHallOrSound ? dto.price : null,
              },
            },
          },
        },

        // BankAccount سيتم إضافته لاحقاً بعد القبول
      },
    });

    // 6. إرسال OTP
    const otpCode = await this.otpService.sendOtp(dto.email);
    const isDev = process.env.NODE_ENV !== 'production';

    return {
      message: 'Registration successful. Please verify your email with the OTP sent.',
      data: { 
        email: dto.email,
        ...(isDev && { otpCode }),
      },
    };
  }

  /**
   * Provider Login
   * يُرجع approvalStatus مع التوكنات
   */
  async loginProvider(dto: LoginDto) {
    // 1. البحث عن المستخدم
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { provider: true },
    });

    if (!user || !user.passwordHash || user.role !== UserRole.PROVIDER) {
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
      data: {
        ...tokens,
        approvalStatus: user.provider?.approvalStatus || 'PENDING',
      },
    };
  }

  /**
   * التحقق من حالة القبول
   */
  async checkApprovalStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { 
        provider: {
          include: {
            services: true,
          },
        },
      },
    });

    if (!user || !user.provider) {
      throw new BadRequestException('Provider not found');
    }

    const approvalStatus = user.provider.approvalStatus;
    const firstService = user.provider.services[0];

    return {
      approvalStatus,
      serviceType: firstService?.serviceType,
      isServiceCompleted: firstService?.isCompleted ?? false,
      message:
        approvalStatus === 'APPROVED'
          ? 'Your account is approved'
          : approvalStatus === 'REJECTED'
          ? 'Your account was rejected'
          : 'Your account is under review',
      canAccessDashboard: approvalStatus === 'APPROVED',
      needsCompletion: approvalStatus === 'APPROVED' && !firstService?.isCompleted,
    };
  }

  /**
   * تفعيل البريد الإلكتروني للـ Provider بعد OTP
   */
  async activateProviderEmail(email: string) {
    const user = await this.prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      approvalStatus: 'PENDING', // ينتظر موافقة الـ Admin
    };
  }

  /**
   * Helper: توليد Tokens
   */
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}