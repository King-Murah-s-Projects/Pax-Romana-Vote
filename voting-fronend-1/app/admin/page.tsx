"use client"

import { useEffect, useState } from "react"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { AuthForms } from "@/components/auth/auth-forms"
import { useAuth } from "@/lib/auth-context"

type AuthMode = "login" | "signup"

export default function AdminPage() {
    const { isAuthenticated, user } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [authMode, setAuthMode] = useState<AuthMode>("login")

    useEffect(() => {
        // Simulate checking auth state
        const timer = setTimeout(() => {
            setIsLoading(false)
        }, 1000)

        return () => clearTimeout(timer)
    }, [])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white">Loading admin panel...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <AuthForms mode={authMode} onModeChange={setAuthMode} />
    }

    if (user && !["SUPER_ADMIN", "EC_MEMBER"].includes(user.role)) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
                    <p className="text-sm text-gray-500 mt-2">Your role: {user.role}</p>
                </div>
            </div>
        )
    }

    return <AdminDashboard />
}