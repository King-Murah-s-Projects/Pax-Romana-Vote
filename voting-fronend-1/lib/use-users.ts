import { useState, useEffect, useCallback } from 'react';
import { usersApi, User, UserRole, UserStatsDto, CreateUserDto, CreateAdminDto, UpdateUserDto, PaginatedResponse, handleApiError } from './api-config';

interface UseUsersResult {
    // Data
    users: User[];
    user: User | null;
    stats: UserStatsDto | null;
    ecMembers: User[];
    admins: User[];

    // Pagination
    currentPage: number;
    totalPages: number;
    totalUsers: number;

    // State
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchUsers: (page?: number, limit?: number, role?: UserRole) => Promise<void>;
    fetchUserById: (id: string) => Promise<void>;
    fetchStats: () => Promise<void>;
    fetchECMembers: () => Promise<void>;
    fetchAdmins: () => Promise<void>;
    createUser: (userData: CreateUserDto) => Promise<User>;
    createAdmin: (adminData: CreateAdminDto) => Promise<User>;
    updateUser: (id: string, updateData: UpdateUserDto) => Promise<User>;
    updateVerificationStatus: (id: string, isVerified: boolean) => Promise<User>;
    suspendUser: (id: string) => Promise<User>;
    reactivateUser: (id: string) => Promise<User>;
    deleteUser: (id: string) => Promise<void>;
    clearError: () => void;
    refetch: () => Promise<void>;
}

export function useUsers(initialPage: number = 1, initialLimit: number = 10): UseUsersResult {
    const [users, setUsers] = useState<User[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<UserStatsDto | null>(null);
    const [ecMembers, setECMembers] = useState<User[]>([]);
    const [admins, setAdmins] = useState<User[]>([]);

    const [currentPage, setCurrentPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(0);
    const [totalUsers, setTotalUsers] = useState(0);
    const [limit] = useState(initialLimit);
    const [currentRole, setCurrentRole] = useState<UserRole | undefined>();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const fetchUsers = useCallback(async (page: number = currentPage, pageLimit: number = limit, role?: UserRole) => {
        try {
            setIsLoading(true);
            setError(null);

            const response: PaginatedResponse<User> = await usersApi.findAll(page, pageLimit, role);

            setUsers(response.data);
            setCurrentPage(response.page);
            setTotalPages(response.totalPages);
            setTotalUsers(response.total);
            setCurrentRole(role);
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, limit]);

    const fetchUserById = useCallback(async (id: string) => {
        try {
            setIsLoading(true);
            setError(null);

            const userData = await usersApi.findById(id);
            setUser(userData);
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            setError(null);

            const statsData = await usersApi.getUserStats();
            setStats(statsData);
        } catch (err) {
            setError(handleApiError(err));
        }
    }, []);

    const fetchECMembers = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const members = await usersApi.getECMembers();
            setECMembers(members);
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchAdmins = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const adminsList = await usersApi.getAdmins();
            setAdmins(adminsList);
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createUser = useCallback(async (userData: CreateUserDto): Promise<User> => {
        try {
            setError(null);

            const newUser = await usersApi.create(userData);

            // Refresh the users list
            await fetchUsers();

            return newUser;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, [fetchUsers]);

    const createAdmin = useCallback(async (adminData: CreateAdminDto): Promise<User> => {
        try {
            setError(null);

            const newAdmin = await usersApi.createAdmin(adminData);

            // Refresh the users list and admins list
            await Promise.all([fetchUsers(), fetchAdmins()]);

            return newAdmin;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, [fetchUsers, fetchAdmins]);

    const updateUser = useCallback(async (id: string, updateData: UpdateUserDto): Promise<User> => {
        try {
            setError(null);

            const updatedUser = await usersApi.update(id, updateData);

            // Update the user in the list
            setUsers(prevUsers =>
                prevUsers.map(u => u.id === id ? updatedUser : u)
            );

            // Update single user if it's the same one
            if (user?.id === id) {
                setUser(updatedUser);
            }

            return updatedUser;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, [user]);

    const updateVerificationStatus = useCallback(async (id: string, isVerified: boolean): Promise<User> => {
        try {
            setError(null);

            const updatedUser = await usersApi.updateVerificationStatus(id, isVerified);

            // Update the user in the list
            setUsers(prevUsers =>
                prevUsers.map(u => u.id === id ? updatedUser : u)
            );

            // Update single user if it's the same one
            if (user?.id === id) {
                setUser(updatedUser);
            }

            return updatedUser;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, [user]);

    const suspendUser = useCallback(async (id: string): Promise<User> => {
        try {
            setError(null);

            const updatedUser = await usersApi.suspendUser(id);

            // Update the user in the list
            setUsers(prevUsers =>
                prevUsers.map(u => u.id === id ? updatedUser : u)
            );

            // Update single user if it's the same one
            if (user?.id === id) {
                setUser(updatedUser);
            }

            return updatedUser;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, [user]);

    const reactivateUser = useCallback(async (id: string): Promise<User> => {
        try {
            setError(null);

            const updatedUser = await usersApi.reactivateUser(id);

            // Update the user in the list
            setUsers(prevUsers =>
                prevUsers.map(u => u.id === id ? updatedUser : u)
            );

            // Update single user if it's the same one
            if (user?.id === id) {
                setUser(updatedUser);
            }

            return updatedUser;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, [user]);

    const deleteUser = useCallback(async (id: string): Promise<void> => {
        try {
            setError(null);

            await usersApi.softDelete(id);

            // Remove the user from the list
            setUsers(prevUsers => prevUsers.filter(u => u.id !== id));

            // Clear single user if it's the same one
            if (user?.id === id) {
                setUser(null);
            }

            // Refresh stats to get updated counts
            await fetchStats();
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, [user, fetchStats]);

    const refetch = useCallback(async () => {
        await fetchUsers(currentPage, limit, currentRole);
    }, [fetchUsers, currentPage, limit, currentRole]);

    // Initial load
    useEffect(() => {
        fetchUsers();
    }, []);

    return {
        // Data
        users,
        user,
        stats,
        ecMembers,
        admins,

        // Pagination
        currentPage,
        totalPages,
        totalUsers,

        // State
        isLoading,
        error,

        // Actions
        fetchUsers,
        fetchUserById,
        fetchStats,
        fetchECMembers,
        fetchAdmins,
        createUser,
        createAdmin,
        updateUser,
        updateVerificationStatus,
        suspendUser,
        reactivateUser,
        deleteUser,
        clearError,
        refetch,
    };
}

// Additional hook for user profile management
export function useUserProfile() {
    const [profile, setProfile] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const profileData = await usersApi.getProfile();
            setProfile(profileData);
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return {
        profile,
        isLoading,
        error,
        fetchProfile,
        clearError,
    };
}