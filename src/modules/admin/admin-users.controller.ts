import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AdminUseresService } from './admin-useres.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@ApiTags('Admin Users')
@ApiBearerAuth('JWT-auth')
@Controller('admin-users')
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUseresService,
  ) {}

  @Get('providers/pending')
  @ApiOperation({
    summary: 'Get pending provider applications',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending providers retrieved successfully',
  })
  getPendingProviders(
    @Query() paginationDto: PaginationDto,
  ) {
    return this.adminUsersService.getPendingProviders(
      paginationDto,
    );
  }

  @Get('providers/:providerId')
  @ApiOperation({
    summary: 'Get provider details',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider details retrieved successfully',
  })
  getProviderDetails(
    @Param('providerId') providerId: string,
  ) {
    return this.adminUsersService.getProviderDetails(
      providerId,
    );
  }
}