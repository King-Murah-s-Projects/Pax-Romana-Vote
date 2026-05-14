"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
    BarChart3,
    Users,
    Vote,
    UserCheck,
    Settings,
    LogOut,
    Menu,
    X,
    Shield,
    FileText,
    Bell,
    Home,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"

interface SidebarProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

export function AdminSidebar({ activeTab, onTabChange }: SidebarProps) {
    const { user, logout } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleLogout = () => {
        logout()
        router.push("/admin/login")
    }

    const getRoleDisplayName = (role: string) => {
        switch (role) {
            case "super_admin":
                return "EC Chairperson"
            case "ec_member":
                return "EC Member"
            default:
                return role
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case "super_admin":
                return "bg-red-100 text-red-800 border-red-200"
            case "ec_member":
                return "bg-blue-100 text-blue-800 border-blue-200"
            default:
                return "bg-gray-100 text-gray-800 border-gray-200"
        }
    }

    const menuItems = [
        { id: "overview", label: "Dashboard", icon: BarChart3, description: "Election overview and statistics" },
        { id: "candidates", label: "Candidates", icon: UserCheck, description: "Manage candidate nominations" },
        { id: "voting", label: "Voting Monitor", icon: Vote, description: "Real-time voting monitoring" },
        { id: "results", label: "Results", icon: FileText, description: "Election results and reports" },
        { id: "users", label: "User Management", icon: Users, description: "Manage EC members and permissions" },
        { id: "notifications", label: "Notifications", icon: Bell, description: "System alerts and messages" },
        { id: "settings", label: "Settings", icon: Settings, description: "System configuration" },
    ]

    const filteredMenuItems =
        user?.role === "SUPER_ADMIN" ? menuItems : menuItems.filter((item) => !["users", "settings"].includes(item.id))

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3 mb-4">
                    <Image
                        src="/images/imcs-pax-romana.png"
                        alt="IMCS-Pax Romana"
                        width={40}
                        height={40}
                        className="rounded-full"
                    />
                    <Image src="/images/Knust_seal.jpg" alt="KNUST" width={40} height={40} className="rounded-full" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">IMCS-Pax Romana</h2>
                <p className="text-sm text-blue-600 font-medium">Election Commission</p>
                <p className="text-xs text-gray-500 mt-1">Liberation for Peace</p>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                </div>
                <div className="mt-2">
                    <Badge className={`text-xs ${getRoleBadgeColor(user?.role || "")}`}>
                        {getRoleDisplayName(user?.role || "")}
                    </Badge>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-left h-auto p-3 hover:bg-blue-50"
                    onClick={() => router.push("/")}
                >
                    <Home className="h-4 w-4 mr-3 text-gray-500" />
                    <div>
                        <div className="text-sm font-medium text-gray-900">Back to Voting</div>
                        <div className="text-xs text-gray-500">Return to main site</div>
                    </div>
                </Button>

                <div className="border-t border-gray-200 pt-4 mt-4">
                    {filteredMenuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeTab === item.id

                        return (
                            <Button
                                key={item.id}
                                variant={isActive ? "default" : "ghost"}
                                className={`w-full justify-start text-left h-auto p-3 mb-1 ${
                                    isActive ? "bg-blue-600 text-white hover:bg-blue-700" : "hover:bg-gray-50 text-gray-700"
                                }`}
                                onClick={() => {
                                    onTabChange(item.id)
                                    setIsMobileMenuOpen(false)
                                }}
                            >
                                <Icon className={`h-4 w-4 mr-3 ${isActive ? "text-white" : "text-gray-500"}`} />
                                <div>
                                    <div className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-900"}`}>{item.label}</div>
                                    <div className={`text-xs ${isActive ? "text-blue-100" : "text-gray-500"}`}>{item.description}</div>
                                </div>
                            </Button>
                        )
                    })}
                </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sign Out
                </Button>
            </div>
        </div>
    )

    return (
        <>
            {/* Mobile Menu Button */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="bg-white shadow-md"
                >
                    {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden lg:block w-80 h-screen fixed left-0 top-0 z-40">
                <SidebarContent />
            </div>

            {/* Mobile Sidebar */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-40">
                    <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="fixed left-0 top-0 w-80 h-full z-50">
                        <SidebarContent />
                    </div>
                </div>
            )}
        </>
    )
}
