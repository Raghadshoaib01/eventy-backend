import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ComplaintsService } from '../complaints.service';
import { CreateComplaintDto } from '../dto/create-complaint.dto';
import { ComplaintsQueryDto } from '../dto/complaints-query.dto';

/**
 * Complainant-facing Complaints API — customer or provider
 * (docs/complaints-implementation-plan.md §4.1).
 */
@ApiTags('Complaints')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @ApiOperation({ summary: 'File a complaint' })
  create(@Request() req, @Body() dto: CreateComplaintDto) {
    return this.complaintsService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my complaints' })
  findMine(@Request() req, @Query() query: ComplaintsQueryDto) {
    return this.complaintsService.listMine(req.user.sub, query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiOperation({ summary: 'Complaint detail, including admin reply and status' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.complaintsService.getMine(req.user.sub, id);
  }
}
