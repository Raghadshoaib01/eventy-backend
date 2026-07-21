import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ComplaintsService } from '../complaints.service';
import { ComplaintsQueryDto } from '../dto/complaints-query.dto';
import { UpdateComplaintStatusDto } from '../dto/update-complaint-status.dto';
import { ReplyComplaintDto } from '../dto/reply-complaint.dto';

/**
 * Admin-facing Complaints API (docs/complaints-implementation-plan.md §4.2).
 */
@ApiTags('Admin - Complaints')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/complaints')
export class AdminComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  @ApiOperation({ summary: 'List/filter/search all complaints' })
  findAll(@Query() query: ComplaintsQueryDto) {
    return this.complaintsService.listAll(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiOperation({ summary: 'Complaint detail' })
  findOne(@Param('id') id: string) {
    return this.complaintsService.getForAdmin(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiOperation({ summary: 'Change complaint status' })
  updateStatus(@Request() req, @Param('id') id: string, @Body() dto: UpdateComplaintStatusDto) {
    return this.complaintsService.updateStatus(req.user.sub, id, dto);
  }

  @Patch(':id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiOperation({ summary: 'Post/update the admin reply' })
  reply(@Request() req, @Param('id') id: string, @Body() dto: ReplyComplaintDto) {
    return this.complaintsService.reply(req.user.sub, id, dto);
  }
}
