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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Register new service provider (3 steps in one request)',
    description: 'Step 1: Account Info | Step 2: Business Info + Location (Map) | Step 3: First Service Info (no sub-services for halls and djs)'
  })
  @ApiBody({ type: RegisterProviderDto }) 
//   @ApiBody({
//     schema: {
//       type: 'object',
//       required: [
//         'fullName', 'email', 'phoneNumber', 'password',
//         'businessName', 'businessLicense', 
//         //'iban', 'bankName', 'accountHolderName',
//         'serviceType', 'eventTypes', 
//         //'availableFrom', 'availableTo', 'dailyCapacity', 'capacityUnit'
//       ],
//       properties: {
//         // Step 1: Account
//         fullName: { type: 'string', example: 'Ahmad Mohammad' },
//         email: { type: 'string', example: 'ahmad@alnoor.com' },
//         phoneNumber: { type: 'string', example: '+962791234567' },
//         password: { type: 'string', example: 'Password@123' },
//         locationName: {type: 'string', example: '123 Main St'},
//         longitude:    {type: 'Number', example: '35.9106'},
//         latitude:     {type: 'Number', example: '35.9106'},
//         // Step 2: Business
//         businessName: { type: 'string', example: 'Al-Noor Catering' },
//         businessLicense: { type: 'string', example: 'CR-12345678' },
//         //iban: { type: 'string', example: 'JO00 0000 0000 0000 0000 0000 00' },
//         //bankName: { type: 'string', example: 'Arab Bank' },
//         //accountHolderName: { type: 'string', example: 'Ahmad Mohammad' },
        
//         // Step 3: Service
//  serviceTypeId: { 
//         type: 'string', 
//         example: '0c20ea51-abc5-46e7-aa1a-1d07cf7a148a',
//         description: 'Get this from GET /service-types'
//       },
//         eventTypes: { type: 'array', items: { type: 'string' }, example: ['WEDDING', 'ENGAGEMENT'] },
//         description: { type: 'string', example: 'Premium catering service' },
//         // availableFrom: { type: 'string', example: '08:00' },
//         // availableTo: { type: 'string', example: '23:00' },
//         // dailyCapacity: { type: 'number', example: 5 },
//         // capacityUnit: { type: 'string', enum: ['BOOKING', 'ITEM', 'SESSION'], example: 'BOOKING' },
        
//         // Optional
//          minCapacity: { type: 'number', example: 50 },
//         maxCapacity: { type: 'number', example: 500 },
//         price: { type: 'number', example: 2000 },
//        profileImage: { type: 'string', format: 'binary' },
//       },
//     },
//   })
  @ApiResponse({ status: 201, description: 'OTP sent to email' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async registerProvider(
    @Body() dto: RegisterProviderDto,
    @UploadedFile() profileImage?: Express.Multer.File,
  ) {
    return this.providerAuthService.registerProvider(dto, profileImage);
  }

  // ========== Provider Login ==========
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Provider login' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns tokens + approvalStatus',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Login successful',
        data: {
          accessToken: 'eyJhbGc...',
          refreshToken: 'eyJhbGc...',
          approvalStatus: 'PENDING' // or 'APPROVED' or 'REJECTED'
        }
      }
    }
  })
  async loginProvider(@Body() dto: LoginDto) {
    return this.providerAuthService.loginProvider(dto);
  }

  // ========== API #4: Check Approval Status ==========
  @Get('check-approval')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Check provider approval status',
    description: 'Used after OTP verification to check if provider can access dashboard'
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
          canAccessDashboard: true
        }
      }
    }
  })
  async checkApproval(@Request() req) {
    return this.providerAuthService.checkApprovalStatus(req.user.sub);
  }
}