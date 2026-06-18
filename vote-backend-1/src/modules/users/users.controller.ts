import {Body, Controller, Post, UseGuards, Get, Put, Delete, Param, Query, Request} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateAdminDTO } from "./dto/create-admin.dto";
import { UpdateUserDTO } from "./dto/update-user.dto";
// import { UserRole } from "./enums/user-roles.enum";
import { UserRole } from "@prisma/client/index";
import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {RolesGuard} from "../auth/guards/roles.guard";
import {Roles} from "../auth/decorators/roles.decorator";
import { UserStatsDto } from "./dto/user-profile.dto";

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    // Create regular user
    @Post()
    async create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }

    // Create an admin user (Super Admin only)
    @Post('admin')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async createAdmin(@Body() createAdminDto: CreateAdminDTO) {
        return this.usersService.createAdmin(createAdminDto);
    }

    // Get current user profile
    @Get('profile')
    async getProfile(@Request() req) {
        return this.usersService.getUserProfile(req.user.id);
    }

    // Get all users (Admin only)
    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.EC_MEMBER)
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('role') role?: UserRole,
    ) {
        return this.usersService.findAll(page, limit, role);
    }

    // Get user statistics (Admin only)
    @Get('stats')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.EC_MEMBER)
    async getUserStats(): Promise<UserStatsDto> {
        return this.usersService.getUserStats();
    }

    // Get EC members (Admin only)
    @Get('ec-members')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.EC_MEMBER)
    async getECMembers() {
        return this.usersService.getECMembers();
    }

    // Get all admins (Super Admin only)
    @Get('admins')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async getAdmins() {
        return this.usersService.getAdmins();
    }

    // Get user by ID (Admin only)
    @Get(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.EC_MEMBER)
    async findById(@Param('id') id: string) {
        return this.usersService.findById(id);
    }

    // Update user (Admin only)
    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDTO) {
        return this.usersService.update(id, updateUserDto);
    }

    // Update verification status (Admin only)
    @Put(':id/verify')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.EC_MEMBER)
    async updateVerificationStatus(@Param('id') id: string, @Body('isVerified') isVerified: boolean) {
        return this.usersService.updateEmailVerificationStatus(id, isVerified);
    }

    // Suspend user (Admin only)
    @Put(':id/suspend')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async suspendUser(@Param('id') id: string) {
        return this.usersService.suspendUser(id);
    }

    // Reactivate the user (Admin only)
    @Put(':id/reactivate')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async reactivateUser(@Param('id') id: string) {
        return this.usersService.reactivateUser(id);
    }

    // Soft delete user (Super Admin only)
    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    async softDelete(@Param('id') id: string) {
        return this.usersService.softDelete(id);
    }
}
