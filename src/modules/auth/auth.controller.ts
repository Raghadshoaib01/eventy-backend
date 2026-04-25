import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  RequestResetPasswordDto,
  ConfirmResetPasswordDto,
} from './dto/reset-password.dto';
import { GoogleAuthGuard } from 'src/common/guards/google-auth.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //1 POST /api/v1/auth/register
  @Post('register')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiBody({
  schema: {
    type: 'object',
    required: ['fullName', 'email', 'phoneNumber', 'password'],
    properties: {
      fullName:     { type: 'string', example: 'Sarah Ahmed' },
      email:        { type: 'string', example: 'sarah@example.com' },
      phoneNumber:  { type: 'string', example: '+962791234567' },
      password:     { type: 'string', example: 'Password@123' },
      address:      { type: 'string', example: '123 Main St' },
      profileImage: { type: 'string', format: 'binary' },
    },
  },
})
  @ApiResponse({ status: 201, description: 'OTP sent to email' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto,
  @UploadedFile() profileImage?: Express.Multer.File,
) {
    return this.authService.signup(dto,profileImage);
  }

  //2 POST /api/v1/auth/verify-otp
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and activate account' })
  @ApiResponse({ status: 200, description: 'Returns access & refresh tokens' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  //3 POST /api/v1/auth/resend-otp
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP to email' })
  @ApiResponse({ status: 200, description: 'New OTP sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  //4 POST /api/v1/auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns access & refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  //5 POST /api/v1/auth/refresh
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({
    schema: { properties: { refreshToken: { type: 'string' } } },
  })
  refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  //6 POST /api/v1/auth/logout
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')//swagger tag
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiBody({
    schema: { properties: { refreshToken: { type: 'string' } } },
  })
  logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }

  //7 POST /api/v1/auth/change-password
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change password (authenticated user)' })
  changePassword(
    @Request() req,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.sub, dto);
  }

  //8 POST /api/v1/auth/reset-password/request
  @Post('reset-password/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP via email' })
  requestReset(@Body() dto: RequestResetPasswordDto) {
    return this.authService.requestReset(dto);
  }

  //9 POST /api/v1/auth/reset-password/confirm
  @Post('reset-password/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm OTP and set new password' })
  confirmReset(@Body() dto: ConfirmResetPasswordDto) {
    return this.authService.confirmReset(dto);
  }

  //10 GET /api/v1/auth/google
  @Get('google')
@UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirect to Google OAuth' })
  googleAuth() {
    // Guard يتعامل معها
  }

  //11 GET /api/v1/auth/google/callback
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint() 
  googleCallback(@Request() req) {
    return this.authService.googleLogin(req.user);
  }
}