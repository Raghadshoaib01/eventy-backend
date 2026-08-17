// src/modules/packages/packages.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { BookPackageDto } from './dto/book-package.dto';
import { PayPackageBookingDto } from './dto/pay-package-booking.dto';
import { PackageBookingDecisionDto } from './dto/package-booking-decision.dto';
import { PackageBookingCancelDto } from './dto/package-booking-cancel.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PackageEventBookingStatus, UserRole } from '@prisma/client';
import { Audit } from 'src/common/decorators/audit.decorator';
import { AuditAction } from '@prisma/client';
import { PackageBookingQueryDto } from './dto/package-booking-query.dto';


@ApiBearerAuth('JWT-auth')
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}
  // ════════════════════════════════════════════════════════════════════
  // CUSTOMER — exclusive-package browsing + booking + payment
  // ════════════════════════════════════════════════════════════════════

  @Get('exclusive')
  @ApiTags('Packages-Customer')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Browse all ACTIVE exclusive packages',
    description: '**Allowed roles:** any authenticated user (typically CUSTOMER).',
  })
  listExclusivePackages() {
    return this.packagesService.listExclusivePackages();
  }

  @Get('exclusive/:id')
  @ApiTags('Packages-Customer')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Get details of an exclusive package',
    description: '**Allowed roles:** any authenticated user (typically CUSTOMER).',
  })
  getExclusivePackageDetails(@Param('id') id: string) {
    return this.packagesService.getExclusivePackageDetails(id);
  }

  @Post('exclusive/:id/book')
  @ApiTags('Packages-Customer')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Audit({ action: AuditAction.BOOKING_CREATE, entity: 'PackageEventBooking', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Book an entire exclusive package',
    description: '**Allowed roles:** any authenticated user (service-level checks verify CUSTOMER ownership).',
  })
  bookPackage(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: BookPackageDto,
  ) {
    return this.packagesService.bookPackage(req.user.sub, id, dto);
  }

  @Post('bookings/:id/pay')
  @ApiTags('Packages-Customer')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UPDATE, entity: 'PackageEventBooking', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'PackageEventBooking UUID' })
  @ApiOperation({
    summary: 'Pay for an accepted package booking (BANK_TRANSFER or CASH)',
    description: '**Allowed roles:** the customer who owns the package booking.',
  })
  payPackageBooking(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: PayPackageBookingDto,
  ) {
    return this.packagesService.payPackageBooking(req.user.sub, id, dto);
  }

  @Post('bookings/:id/confirm-card-payment')
  @ApiTags('Packages-Customer')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UPDATE, entity: 'PackageEventBooking', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'PackageEventBooking UUID' })
  @ApiOperation({
    summary: 'Confirm a package payment after client-side Payment Sheet success',
    description: '**Allowed roles:** the customer who owns the package booking. Only relevant when BANK_TRANSFER returned a clientSecret.',
  })
  confirmPackageCardPayment(@Request() req, @Param('id') id: string) {
    return this.packagesService.confirmPackageCardPayment(req.user.sub, id);
  }

  @Post('bookings/:id/cancel')
  @ApiTags('Packages-Customer')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BOOKING_CANCEL, entity: 'PackageEventBooking', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'PackageEventBooking UUID' })
  @ApiOperation({
    summary: 'Cancel my package booking',
    description: '**Allowed roles:** the customer who owns the package booking.',
  })
  cancelPackageBooking(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: PackageBookingCancelDto,
  ) {
    return this.packagesService.cancelPackageBooking(req.user.sub, id, dto.reason);
  }
  
  @Get('my-bookings')
@ApiTags('Packages-Customer')
@UseGuards(JwtAuthGuard)
@ApiOperation({
  summary: 'Get my package bookings (optionally filtered by status)',
  description: '**Allowed roles:** the current customer.',
})
getMyPackageBookings(@Request() req, @Query() query: PackageBookingQueryDto) {
  return this.packagesService.getMyPackageBookings(req.user.sub, query);
}

@Get('bookings')
@ApiTags('Packages-Provider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROVIDER)
@ApiOperation({
  summary: 'Get my package bookings, optionally filtered by status',
  description:
    '**Allowed roles:** PROVIDER (package owner only). Omit ?status to get all(PENDING, CONFIRMED, PENDING_PAYMENT, IN_PROGRESS, COMPLETED) together.\n' +
  '**Filterable statuses:** PENDING, CONFIRMED, PENDING_PAYMENT, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED, EXPIRED.',
})
getPackageBookings(@Request() req, @Query('status') status?: PackageEventBookingStatus) {
  return this.packagesService.getPackageBookings(req.user.sub, status);
}


  // ════════════════════════════════════════════════════════════════════
  // PROVIDER — package authoring & lifecycle
  // ════════════════════════════════════════════════════════════════════

  @Post()
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new package (DRAFT) and attach services',
    description:
      '**Allowed roles:** PROVIDER. Creates a DRAFT package and one ACTIVE ' +
      'PackageService row per supplied serviceId. All services must be owned ' +
      'by the calling provider.',
  })
  @ApiResponse({ status: 201, description: 'Package created in DRAFT' })
  createPackage(@Request() req, @Body() dto: CreatePackageDto) {
    return this.packagesService.createPackage(req.user.sub, dto);
  }

  @Get('my-packages')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiOperation({
    summary: 'Get my packages',
    description: '**Allowed roles:** PROVIDER.',
  })
  getMyPackages(@Request() req) {
    return this.packagesService.getMyPackages(req.user.sub);
  }

  @Get('joined')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiOperation({
    summary: 'Get packages I have joined (services from)',
    description: '**Allowed roles:** PROVIDER.',
  })
  getJoinedPackages(@Request() req) {
    return this.packagesService.getJoinedPackages(req.user.sub);
  }

  @Get('joined/:id')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Get a joined package details',
    description: '**Allowed roles:** PROVIDER.',
  })
  getJoinedPackageDetails(@Request() req, @Param('id') id: string) {
    return this.packagesService.getJoinedPackageDetails(req.user.sub, id);
  }

  @Get(':id')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Get package details (provider view)',
    description: 'Use[ GET /api/v1/packages/joined/{id}  Get a joined package details] instead.',
      deprecated: true,
  })
  getPackage(@Request() req, @Param('id') id: string) {
    return this.packagesService.getPackageForProvider(req.user.sub, id);
  }

  @Patch(':id')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @Audit({ action: AuditAction.UPDATE, entity: 'Package', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Update DRAFT package metadata',
    description: '**Allowed roles:** PROVIDER (owner only).',
  })
  updatePackage(@Request() req, @Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packagesService.updatePackage(req.user.sub, id, dto);
  }

  @Patch(':id/activate')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UPDATE, entity: 'Package', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Activate a DRAFT package (requires ≥ 2 active services)',
    description: '**Allowed roles:** PROVIDER (owner only).',
  })
  activatePackage(@Request() req, @Param('id') id: string) {
    return this.packagesService.activatePackage(req.user.sub, id);
  }

  @Post(':id/leave')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UPDATE, entity: 'Package', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Leave (cancel) a package',
    description: '**Allowed roles:** PROVIDER (owner only).',
  })
  leavePackage(@Request() req, @Param('id') id: string) {
    return this.packagesService.leavePackage(req.user.sub, id);
  }

  // ── join-request inbox (forward-compat) ───────────────────────────

  @Get('join-requests/pending')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiOperation({
    summary: 'Get pending package join requests',
    description: '**Allowed roles:** PROVIDER.',
  })
  getPendingJoinRequests(@Request() req) {
    return this.packagesService.getPendingJoinRequests(req.user.sub);
  }

  @Get('join-requests/:id')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiParam({ name: 'id', description: 'Join request UUID' })
  @ApiOperation({
    summary: 'Get join request details',
    description: '**Allowed roles:** PROVIDER.',
  })
  getJoinRequestDetails(@Request() req, @Param('id') id: string) {
    return this.packagesService.getJoinRequestDetails(req.user.sub, id);
  }

  @Post(':id/join/accept')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.APPROVE, entity: 'Package', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Accept a join request',
    description: '**Allowed roles:** PROVIDER.',
  })
  acceptJoinRequest(@Request() req, @Param('id') id: string) {
    return this.packagesService.acceptJoinRequest(req.user.sub, id);
  }

  @Post(':id/join/reject')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.REJECT, entity: 'Package', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'Package UUID' })
  @ApiOperation({
    summary: 'Reject a join request',
    description: '**Allowed roles:** PROVIDER.',
  })
  rejectJoinRequest(@Request() req, @Param('id') id: string) {
    return this.packagesService.rejectJoinRequest(req.user.sub, id);
  }

  // ── package-event-booking inbox ──────────────────────────────────

  @Get('bookings/pending')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiOperation({
    summary: 'Get pending event-package bookings',
    description: ' Use GET Get my package bookings, optionally filtered by status.',
      deprecated: true,
  })
  getPendingPackageBookings(@Request() req) {
    return this.packagesService.getPendingPackageBookings(req.user.sub);
  }

  @Get('bookings/payment-pending')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiOperation({
    summary: 'Get bookings waiting for payment confirmation',
    description: 'Use GET Get my package bookings, optionally filtered by status.',
      deprecated: true,
  })
  getPaymentPendingPackageBookings(@Request() req) {
    return this.packagesService.getPaymentPendingPackageBookings(req.user.sub);
  }

  @Get('bookings/:id')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @ApiParam({ name: 'id', description: 'PackageEventBooking UUID' })
  @ApiOperation({
    summary: 'Get package booking details (provider view)',
    description: '**Allowed roles:** PROVIDER (package owner only).',
  })
  getPackageBookingForProvider(@Request() req, @Param('id') id: string) {
    return this.packagesService.getPackageBookingForProvider(req.user.sub, id);
  }

  @Post('bookings/:id/accept')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BOOKING_ACCEPT, entity: 'PackageEventBooking', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'PackageEventBooking UUID' })
  @ApiOperation({
    summary: 'Accept a package booking',
    description: '**Allowed roles:** PROVIDER (package owner only).',
  })
  acceptPackageBooking(@Request() req, @Param('id') id: string) {
    return this.packagesService.acceptPackageBooking(req.user.sub, id);
  }

  @Post('bookings/:id/reject')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BOOKING_REJECT, entity: 'PackageEventBooking', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'PackageEventBooking UUID' })
  @ApiOperation({
    summary: 'Reject a package booking',
    description: '**Allowed roles:** PROVIDER (package owner only).',
  })
  rejectPackageBooking(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: PackageBookingDecisionDto,
  ) {
    return this.packagesService.rejectPackageBooking(req.user.sub, id, dto.reason);
  }

  @Post('bookings/:id/confirm-payment')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.UPDATE, entity: 'PackageEventBooking', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'PackageEventBooking UUID' })
  @ApiOperation({
    summary: 'Confirm cash payment for a package booking',
    description: '**Allowed roles:** PROVIDER (package owner only).',
      deprecated: true,
  })
  confirmPackagePayment(@Request() req, @Param('id') id: string) {
    return this.packagesService.confirmPackageCashPayment(req.user.sub, id);
  }

  @Post('bookings/:id/complete')
  @ApiTags('Packages-Provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  @Audit({ action: AuditAction.BOOKING_COMPLETE, entity: 'PackageEventBooking', entityIdKey: 'id' })
  @ApiParam({ name: 'id', description: 'PackageEventBooking UUID' })
  @ApiOperation({
    summary: 'Manually complete a package booking',
    description: '**Allowed roles:** PROVIDER (package owner only).',
  })
  completePackageBooking(@Request() req, @Param('id') id: string) {
    return this.packagesService.completePackageBooking(req.user.sub, id);
  }

}
