"use client"

import React, { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Search,
    Filter,
    MoreHorizontal,
    Edit,
    Trash2,
    UserX,
    UserCheck,
    Shield,
    Mail,
    Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useUsers } from '@/lib/use-users';
import { UserRole, User, CreateUserDto, CreateAdminDto } from '@/lib/api-config';
import { useAuth } from '@/lib/auth-context';

export function UserManagement() {
    const { user: currentUser } = useAuth();
    const {
        users,
        stats,
        isLoading,
        error,
        currentPage,
        totalPages,
        totalUsers,
        fetchUsers,
        fetchStats,
        createUser,
        createAdmin,
        updateVerificationStatus,
        suspendUser,
        reactivateUser,
        deleteUser,
        clearError
    } = useUsers();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole | 'ALL'>('ALL');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [createUserType, setCreateUserType] = useState<'user' | 'admin'>('user');
    const [newUserData, setNewUserData] = useState<CreateUserDto>({
        name: '',
        email: '',
        role: 'VOTER'
    });
    const [newAdminData, setNewAdminData] = useState<CreateAdminDto>({
        name: '',
        email: '',
        password: '',
        role: 'EC_MEMBER'
    });

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleRoleFilter = (role: UserRole | 'ALL') => {
        setSelectedRole(role);
        fetchUsers(1, 10, role === 'ALL' ? undefined : role);
    };

    const handlePageChange = (page: number) => {
        fetchUsers(page, 10, selectedRole === 'ALL' ? undefined : selectedRole);
    };

    const handleCreateUser = async () => {
        try {
            if (createUserType === 'user') {
                await createUser(newUserData);
                setNewUserData({ name: '', email: '', role: 'VOTER' });
            } else {
                await createAdmin(newAdminData);
                setNewAdminData({ name: '', email: '', password: '', role: 'EC_MEMBER' });
            }
            setIsCreateDialogOpen(false);
            await fetchStats(); // Refresh stats
        } catch (error) {
            // The hook handles error
            console.error('Failed to create user:', error);
        }
    };

    const handleVerifyUser = async (userId: string, isVerified: boolean) => {
        try {
            await updateVerificationStatus(userId, isVerified);
            await fetchStats();
        } catch (error) {
            console.error('Failed to update verification status:', error);
        }
    };

    const handleSuspendUser = async (userId: string) => {
        try {
            await suspendUser(userId);
            await fetchStats();
        } catch (error) {
            console.error('Failed to suspend user:', error);
        }
    };

    const handleReactivateUser = async (userId: string) => {
        try {
            await reactivateUser(userId);
            await fetchStats();
        } catch (error) {
            console.error('Failed to reactivate user:', error);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            try {
                await deleteUser(userId);
            } catch (error) {
                console.error('Failed to delete user:', error);
            }
        }
    };

    const getRoleBadgeColor = (role: UserRole) => {
        switch (role) {
            case 'SUPER_ADMIN':
                return 'bg-red-100 text-red-800';
            case 'EC_MEMBER':
                return 'bg-blue-100 text-blue-800';
            case 'VOTER':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getRoleDisplayName = (role: UserRole) => {
        switch (role) {
            case 'SUPER_ADMIN':
                return 'Super Admin';
            case 'EC_MEMBER':
                return 'EC Member';
            case 'VOTER':
                return 'Voter';
            default:
                return role;
        }
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const canCreateAdmin = currentUser?.role === 'SUPER_ADMIN';
    const canDeleteUsers = currentUser?.role === 'SUPER_ADMIN';

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="flex items-center p-6">
                            <Users className="h-8 w-8 text-blue-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Users</p>
                                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center p-6">
                            <Shield className="h-8 w-8 text-green-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Verified Users</p>
                                <p className="text-2xl font-bold">{stats.verifiedUsers}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center p-6">
                            <UserCheck className="h-8 w-8 text-yellow-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Active Users</p>
                                <p className="text-2xl font-bold">{stats.activeUsers}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center p-6">
                            <Users className="h-8 w-8 text-purple-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">EC Members</p>
                                <p className="text-2xl font-bold">{stats.totalECMembers}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>
                        {error}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearError}
                            className="ml-2 h-auto p-0 text-red-600 hover:text-red-800"
                        >
                            Dismiss
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Main Content */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Users Management
                        </CardTitle>

                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="flex items-center gap-2">
                                    <UserPlus className="h-4 w-4" />
                                    Add User
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Create New User</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Button
                                            variant={createUserType === 'user' ? 'default' : 'outline'}
                                            onClick={() => setCreateUserType('user')}
                                            className="flex-1"
                                        >
                                            Regular User
                                        </Button>
                                        {canCreateAdmin && (
                                            <Button
                                                variant={createUserType === 'admin' ? 'default' : 'outline'}
                                                onClick={() => setCreateUserType('admin')}
                                                className="flex-1"
                                            >
                                                Admin User
                                            </Button>
                                        )}
                                    </div>

                                    {createUserType === 'user' ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-sm font-medium">Name</label>
                                                <Input
                                                    value={newUserData.name}
                                                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                                                    placeholder="Enter full name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Email</label>
                                                <Input
                                                    type="email"
                                                    value={newUserData.email}
                                                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                                    placeholder="Enter email address"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Role</label>
                                                <select
                                                    value={newUserData.role}
                                                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as UserRole })}
                                                    className="w-full p-2 border border-gray-300 rounded-md"
                                                >
                                                    <option value="VOTER">Voter</option>
                                                    <option value="EC_MEMBER">EC Member</option>
                                                </select>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-sm font-medium">Name</label>
                                                <Input
                                                    value={newAdminData.name}
                                                    onChange={(e) => setNewAdminData({ ...newAdminData, name: e.target.value })}
                                                    placeholder="Enter full name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Email</label>
                                                <Input
                                                    type="email"
                                                    value={newAdminData.email}
                                                    onChange={(e) => setNewAdminData({ ...newAdminData, email: e.target.value })}
                                                    placeholder="Enter email address"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Password</label>
                                                <Input
                                                    type="password"
                                                    value={newAdminData.password}
                                                    onChange={(e) => setNewAdminData({ ...newAdminData, password: e.target.value })}
                                                    placeholder="Enter password"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Role</label>
                                                <select
                                                    value={newAdminData.role}
                                                    onChange={(e) => setNewAdminData({ ...newAdminData, role: e.target.value as UserRole })}
                                                    className="w-full p-2 border border-gray-300 rounded-md"
                                                >
                                                    <option value="EC_MEMBER">EC Member</option>
                                                    <option value="SUPER_ADMIN">Super Admin</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-4">
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsCreateDialogOpen(false)}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleCreateUser}
                                            disabled={isLoading}
                                            className="flex-1"
                                        >
                                            {isLoading ? 'Creating...' : 'Create User'}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Search and Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search users by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant={selectedRole === 'ALL' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleRoleFilter('ALL')}
                            >
                                All
                            </Button>
                            <Button
                                variant={selectedRole === 'VOTER' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleRoleFilter('VOTER')}
                            >
                                Voters
                            </Button>
                            <Button
                                variant={selectedRole === 'EC_MEMBER' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleRoleFilter('EC_MEMBER')}
                            >
                                EC Members
                            </Button>
                            <Button
                                variant={selectedRole === 'SUPER_ADMIN' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleRoleFilter('SUPER_ADMIN')}
                            >
                                Admins
                            </Button>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Verification</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">
                                            <div className="flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                                <span className="ml-2">Loading users...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                            No users found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <div className="flex-shrink-0">
                                                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                        <div className="text-sm text-gray-500">{user.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={getRoleBadgeColor(user.role)}>
                                                    {getRoleDisplayName(user.role)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.isActive ? 'default' : 'secondary'}>
                                                    {user.isActive ? 'Active' : 'Suspended'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.emailVerified ? 'default' : 'destructive'}>
                                                    {user.emailVerified ? 'Verified' : 'Unverified'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => console.log('View user', user.id)}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </DropdownMenuItem>

                                                        <DropdownMenuItem
                                                            onClick={() => handleVerifyUser(user.id, !user.emailVerified)}
                                                        >
                                                            <Mail className="mr-2 h-4 w-4" />
                                                            {user.emailVerified ? 'Unverify' : 'Verify'} Email
                                                        </DropdownMenuItem>

                                                        {user.isActive ? (
                                                            <DropdownMenuItem
                                                                onClick={() => handleSuspendUser(user.id)}
                                                                className="text-orange-600"
                                                            >
                                                                <UserX className="mr-2 h-4 w-4" />
                                                                Suspend User
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                onClick={() => handleReactivateUser(user.id)}
                                                                className="text-green-600"
                                                            >
                                                                <UserCheck className="mr-2 h-4 w-4" />
                                                                Reactivate User
                                                            </DropdownMenuItem>
                                                        )}

                                                        {canDeleteUsers && user.id !== currentUser?.id && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                className="text-red-600"
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete User
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalUsers)} of {totalUsers} users
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1 || isLoading}
                                >
                                    Previous
                                </Button>
                                <span className="flex items-center px-3 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages || isLoading}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Also export as AdminUsersComponent for backward compatibility
export const AdminUsersComponent = UserManagement;