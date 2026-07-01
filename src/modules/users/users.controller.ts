import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ────────────────────────────────────────────
  // GET /users/:id?
  // Single route, role-branching (see decision 4):
  //  - ADMIN: id is required, returns that user's profile.
  //  - Otherwise: id is ignored, returns the caller's own profile from the token.
  // ────────────────────────────────────────────
  @Get(':id?')
  @ApiOperation({
    summary: 'Get user profile (self, or by ID as admin)',
    description: 'Admins must provide an id and receive that user\'s profile. Any other role ignores the id and always receives their own profile.',
  })
  @ApiParam({ name: 'id', required: false, description: 'User ID (required for admin, ignored otherwise)' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 400, description: 'id is required when requesting as admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@Request() req, @Param('id') id?: string) {
    return this.usersService.getProfile(req.user, id);
  }
}
