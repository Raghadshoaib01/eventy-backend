import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { PackagesService } from '../packages.service';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { PriceQuoteQueryDto } from '../dto/price-quote-query.dto';
import { CreatePackageBookingDto } from '../dto/create-package-booking.dto';

/**
 * Customer/public-facing Packages API (docs/packages-implementation-plan.md §5.5).
 */
@ApiTags('Packages')
@UseGuards(JwtAuthGuard)
@Controller('packages')
export class PublicPackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Browse active packages (public — no auth required)' })
  findActive(@Query() query: PaginationDto) {
    return this.packagesService.listPublicPackages(query);
  }

  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({ summary: 'Package detail — required vs. optional services flagged (public)' })
  findOne(@Param('id') id: string) {
    return this.packagesService.getPublicPackageDetail(id);
  }

  @Get(':id/price-quote')
  @Public()
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({
    summary: 'Live price for a candidate guest-count/optional-selection (public)',
    description: 'Computed dynamically, never cached or stored — see docs §11.3.',
  })
  getPriceQuote(@Param('id') id: string, @Query() query: PriceQuoteQueryDto) {
    return this.packagesService.getPriceQuote(id, query);
  }

  @Post(':id/bookings')
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOperation({ summary: 'Book a package (Customer only)', description: 'See docs §12.3.' })
  bookPackage(@Request() req, @Param('id') id: string, @Body() dto: CreatePackageBookingDto) {
    return this.packagesService.bookPackage(req.user.sub, id, dto);
  }

  @Get('bookings/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Package booking ID' })
  @ApiOperation({ summary: 'Package booking detail (Customer, own only)' })
  getPackageBooking(@Request() req, @Param('id') id: string) {
    return this.packagesService.getPackageBookingById(req.user.sub, id);
  }

  @Patch('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Package booking ID' })
  @ApiOperation({
    summary: 'Cancel a package booking (Customer only)',
    description: 'Only possible before payment completes — see docs §12.5.',
  })
  cancelPackageBooking(@Request() req, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.packagesService.cancelPackageBooking(req.user.sub, id, reason);
  }
}
