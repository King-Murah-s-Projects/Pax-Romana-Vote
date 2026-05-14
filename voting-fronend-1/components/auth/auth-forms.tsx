"use client"

import type React from "react"
import { useState } from "react"
import { Eye, EyeOff, Mail, Lock, User, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { usersApi, UserRole, handleApiError } from "@/lib/api-config"
import Image from "next/image"

type AuthMode = "login" | "signup" | "email-verification" | "code-verification"

interface LoginFormData {
    email: string
    password: string
}

interface SignupFormData {
    name: string
    email: string
    password: string
    confirmPassword: string
    role: UserRole
}

interface EmailVerificationData {
    email: string
    name: string
}

interface CodeVerificationData {
    email: string
    verificationCode: string
}

interface AuthFormsProps {
    mode: "login" | "signup"
    onModeChange?: (mode: "login" | "signup") => void
}

export function AuthForms({ mode: initialMode, onModeChange }: AuthFormsProps) {
    const router = useRouter()
    const { login, loginWithCode, sendVerificationCode, error: authError, clearError } = useAuth()

    const [mode, setMode] = useState<AuthMode>(initialMode)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [verificationEmail, setVerificationEmail] = useState<string>("")

    const [loginData, setLoginData] = useState<LoginFormData>({
        email: "",
        password: "",
    })

    const [signupData, setSignupData] = useState<SignupFormData>({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "EC_MEMBER",
    })

    const [emailVerificationData, setEmailVerificationData] = useState<EmailVerificationData>({
        email: "",
        name: "",
    })

    const [codeVerificationData, setCodeVerificationData] = useState<CodeVerificationData>({
        email: "",
        verificationCode: "",
    })

    // Clear errors when switching modes
    const handleModeChange = (newMode: AuthMode) => {
        setMode(newMode)
        setError(null)
        setSuccess(null)
        clearError()
        if (newMode === "login" || newMode === "signup") {
            onModeChange?.(newMode)
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        clearError()

        try {
            await login(loginData.email, loginData.password)
            router.push("/admin")
        } catch (error) {
            setError(error instanceof Error ? error.message : "Login failed")
        } finally {
            setIsLoading(false)
        }
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(null)

        if (signupData.password !== signupData.confirmPassword) {
            setError("Passwords do not match")
            setIsLoading(false)
            return
        }

        if (signupData.password.length < 8) {
            setError("Password must be at least 8 characters long")
            setIsLoading(false)
            return
        }

        try {
            await usersApi.create({
                name: signupData.name,
                email: signupData.email,
                role: signupData.role,
            })

            setSuccess("Account created successfully! Please check your email for verification.")

            // Reset form
            setSignupData({
                name: "",
                email: "",
                password: "",
                confirmPassword: "",
                role: "EC_MEMBER",
            })

            // Switch to email verification mode
            setEmailVerificationData({
                email: signupData.email,
                name: signupData.name,
            })
            setMode("email-verification")
        } catch (error) {
            setError(handleApiError(error))
        } finally {
            setIsLoading(false)
        }
    }

    const handleEmailVerification = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        try {
            const response = await sendVerificationCode(
                emailVerificationData.email,
                emailVerificationData.name,
            )

            setSuccess(`Verification code sent! Check your email.`)
            setVerificationEmail(emailVerificationData.email)
            setCodeVerificationData({
                email: emailVerificationData.email,
                verificationCode: "",
            })
            setMode("code-verification")
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to send verification code")
        } finally {
            setIsLoading(false)
        }
    }

    const handleCodeVerification = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        try {
            await loginWithCode(codeVerificationData.email, codeVerificationData.verificationCode)
            router.push("/admin")
        } catch (error) {
            setError(error instanceof Error ? error.message : "Invalid verification code")
        } finally {
            setIsLoading(false)
        }
    }

    const getRoleDisplayName = (role: UserRole) => {
        switch (role) {
            case "SUPER_ADMIN":
                return "EC Chairperson"
            case "EC_MEMBER":
                return "EC Member"
            case "VOTER":
                return "Voter"
            default:
                return role
        }
    }

    const renderLoginForm = () => (
        <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">
                    Email Address
                </Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="email"
                        type="email"
                        placeholder="your.email@imcs-pax-romana.org"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                        disabled={isLoading}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700">
                    Password
                </Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        className="pl-10 pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
                disabled={isLoading}
            >
                {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center space-y-2">
                <button
                    type="button"
                    onClick={() => handleModeChange("email-verification")}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                    Login with Email Verification
                </button>
                <p className="text-sm text-gray-600">
                    Need an account?{" "}
                    <button
                        type="button"
                        onClick={() => handleModeChange("signup")}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Create Account
                    </button>
                </p>
            </div>
        </form>
    )

    const renderSignupForm = () => (
        <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">
                    Full Name
                </Label>
                <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="name"
                        type="text"
                        placeholder="Your full name"
                        value={signupData.name}
                        onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                        disabled={isLoading}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-gray-700">
                    Email Address
                </Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="signup-email"
                        type="email"
                        placeholder="your.email@imcs-pax-romana.org"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                        disabled={isLoading}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="role" className="text-gray-700">
                    Role
                </Label>
                <div className="relative">
                    <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <select
                        id="role"
                        value={signupData.role}
                        onChange={(e) => setSignupData({ ...signupData, role: e.target.value as UserRole })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 bg-white"
                        required
                        disabled={isLoading}
                    >
                        <option value="EC_MEMBER">EC Member</option>
                        <option value="SUPER_ADMIN">EC Chairperson</option>
                        <option value="VOTER">Voter</option>
                    </select>
                </div>
                <p className="text-xs text-gray-500">Selected: {getRoleDisplayName(signupData.role)}</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-gray-700">
                    Password
                </Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        className="pl-10 pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-700">
                    Confirm Password
                </Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={signupData.confirmPassword}
                        onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                        className="pl-10 pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                    >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
                disabled={isLoading}
            >
                {isLoading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center">
                <p className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <button
                        type="button"
                        onClick={() => handleModeChange("login")}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Sign In
                    </button>
                </p>
            </div>
        </form>
    )

    const renderEmailVerificationForm = () => (
        <form onSubmit={handleEmailVerification} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="verification-name" className="text-gray-700">
                    Full Name
                </Label>
                <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="verification-name"
                        type="text"
                        placeholder="Your full name"
                        value={emailVerificationData.name}
                        onChange={(e) => setEmailVerificationData({ ...emailVerificationData, name: e.target.value })}
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                        disabled={isLoading}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="verification-email" className="text-gray-700">
                    Email Address
                </Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="verification-email"
                        type="email"
                        placeholder="your.email@imcs-pax-romana.org"
                        value={emailVerificationData.email}
                        onChange={(e) => setEmailVerificationData({ ...emailVerificationData, email: e.target.value })}
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                        disabled={isLoading}
                    />
                </div>
            </div>

            <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
                disabled={isLoading}
            >
                {isLoading ? "Sending Code..." : "Send Verification Code"}
            </Button>

            <div className="text-center">
                <p className="text-sm text-gray-600">
                    Have admin credentials?{" "}
                    <button
                        type="button"
                        onClick={() => handleModeChange("login")}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Use Password Login
                    </button>
                </p>
            </div>
        </form>
    )

    const renderCodeVerificationForm = () => (
        <form onSubmit={handleCodeVerification} className="space-y-4">
            <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                    Enter the 6-digit verification code sent to:
                </p>
                <p className="text-sm font-medium text-blue-600">{verificationEmail}</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="verification-code" className="text-gray-700">
                    Verification Code
                </Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        id="verification-code"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={codeVerificationData.verificationCode}
                        onChange={(e) => setCodeVerificationData({ ...codeVerificationData, verificationCode: e.target.value })}
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-center text-lg tracking-widest"
                        required
                        disabled={isLoading}
                        maxLength={6}
                    />
                </div>
            </div>

            <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
                disabled={isLoading}
            >
                {isLoading ? "Verifying..." : "Verify & Login"}
            </Button>

            <div className="text-center space-y-2">
                <button
                    type="button"
                    onClick={() => {
                        setMode("email-verification")
                        setSuccess(null)
                        setError(null)
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                    Resend Code
                </button>
                <p className="text-sm text-gray-600">
                    <button
                        type="button"
                        onClick={() => handleModeChange("login")}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Back to Login
                    </button>
                </p>
            </div>
        </form>
    )

    const getTitle = () => {
        switch (mode) {
            case "login":
                return "Election Commissioner Portal"
            case "signup":
                return "Create EC Account"
            case "email-verification":
                return "Email Verification Login"
            case "code-verification":
                return "Enter Verification Code"
            default:
                return "IMCS-Pax Romana KNUST"
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-yellow-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="w-full max-w-md shadow-xl border-0">
                <CardHeader className="space-y-4 text-center">
                    <div className="flex justify-center items-center space-x-4">
                        <Image
                            src="/images/imcs-pax-romana.jpeg"
                            alt="IMCS-Pax Romana"
                            width={60}
                            height={60}
                            className="rounded-full"
                        />
                        <Image src="/images/Knust_seal.jpg" alt="KNUST" width={60} height={60} className="rounded-full" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold text-gray-900">IMCS-Pax Romana KNUST</CardTitle>
                        <CardDescription className="text-gray-600 mt-2">
                            {getTitle()}
                        </CardDescription>
                        <p className="text-sm text-blue-600 font-medium mt-1">Liberation for Peace</p>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {(error || authError) && (
                        <Alert variant="destructive">
                            <AlertDescription>{error || authError}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="border-green-200 bg-green-50">
                            <AlertDescription className="text-green-800">{success}</AlertDescription>
                        </Alert>
                    )}

                    {mode === "login" && renderLoginForm()}
                    {mode === "signup" && renderSignupForm()}
                    {mode === "email-verification" && renderEmailVerificationForm()}
                    {mode === "code-verification" && renderCodeVerificationForm()}

                    <div className="text-center pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500">International Movement of Catholic Students - Pax Romana</p>
                        <p className="text-xs text-gray-500">Kwame Nkrumah University of Science and Technology</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}