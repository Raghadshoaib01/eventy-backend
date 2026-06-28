import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Get,
  UseGuards,
  Request,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ProviderAuthService } from './provider-auth.service';
import { RegisterProviderDto } from './dto/register-provider.dto';
import { LoginDto } from 'src/modules/auth/dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Provider Auth')
@Controller('auth/provider')
export class ProviderAuthController {
  constructor(private readonly providerAuthService: ProviderAuthService) {}

  // ========== API #1: Provider Registration ==========
  @Post('register')
  @UseInterceptors( FileFieldsInterceptor([
    { name: 'profileImage', maxCount: 1 },
    { name: 'serviceLogo', maxCount: 1 },
    { name: 'businessFile', maxCount: 1 },
  ]),
    )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Register new service provider (3 steps in one request)',
    description:
      'Step 1: Account Info | Step 2: Business Info + Location (Map) | Step 3: First Service Info (no sub-services for halls and djs)',
  })
  @ApiBody({ type: RegisterProviderDto })
  
  @ApiResponse({ status: 201, description: 'OTP sent to email' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async registerProvider(
    @Body() dto: RegisterProviderDto,
@UploadedFiles()
  files: {
    profileImage?: Express.Multer.File[];
    serviceLogo?: Express.Multer.File[];
    businessFile?: Express.Multer.File[];
  },
  ) {
    return this.providerAuthService.registerProvider(
      dto,
      files?.profileImage?.[0],
      files?.serviceLogo?.[0],
      files?.businessFile?.[0],
  );
  }
  // ========== API #4: Check Approval Status ==========
  @Get('check-approval')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Check provider approval status',
    description:
      'Used after OTP verification to check if provider can access dashboard',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Success',
        data: {
          approvalStatus: 'APPROVED',
          message: 'Your account is approved',
          canAccessDashboard: true,
        },
      },
    },
  })
  async checkApproval(@Request() req) {
    return this.providerAuthService.checkApprovalStatus(req.user.sub);
  }
}
