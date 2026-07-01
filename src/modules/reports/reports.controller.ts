import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Admin - Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Home dashboard stats',
    description:
      'Users total + % registered this month, providers total + pending, ' +
      'this-month revenue + MoM %, events total + this-month count, events by status, ' +
      'revenue for the last 6 months, bookings share by service type.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
  getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Analytics stats',
    description:
      'Bookings this week + per weekday, most requested service this month by type, ' +
      'top 5 providers (overall, or scoped via ?serviceType=), events share by type.',
  })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.reportsService.getAnalytics(query);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Paginated recent activity feed (from AuditLog)' })
  @ApiResponse({ status: 200, description: 'Recent activity retrieved successfully' })
  getRecentActivity(@Query() pagination: PaginationDto) {
    return this.reportsService.getRecentActivity(pagination);
  }
}
