"use client"

import { useState } from "react"
import { User, Phone, Shield, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { apiClient } from "@/lib/api-config"
import Image from "next/image"

interface VerificationState {
  name: string
  email: string
  phoneNumber: string
  otp: string
  isCodeSent: boolean
  isLoading: boolean
  error: string | null
}

// Add this phone number normalization function
const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');

  // Handle different formats
  if (digitsOnly.startsWith('233')) {
    // Already in international format without +
    return digitsOnly;
  } else if (digitsOnly.startsWith('0')) {
    // Ghana local format (0XXXXXXXXX) -> convert to international
    return '233' + digitsOnly.substring(1);
  } else if (digitsOnly.length === 9) {
    // Missing leading 0, add country code
    return '233' + digitsOnly;
  }

  return digitsOnly;
};

export function VoterVerification() {
  const router = useRouter()
  const { login } = useAuth()
  const [state, setState] = useState<VerificationState>({
    name: "",
    email: "",
    phoneNumber: "",
    otp: "",
    isCodeSent: false,
    isLoading: false,
    error: null,
  })

  const handleSendCode = async () => {
    if (!state.name.trim() || !state.email.trim() || !state.phoneNumber.trim()) {
      setState((prev) => ({ ...prev, error: "Please fill in all required fields" }))
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(state.email)) {
      setState((prev) => ({ ...prev, error: "Please enter a valid email address" }))
      return
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(state.phoneNumber);

    // Phone number validation
    if (normalizedPhone.length < 12) {
      setState((prev) => ({ ...prev, error: "Please enter a valid Ghanaian phone number" }))
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('Sending verification request with:', {
        name: state.name,
        phoneNumber: normalizedPhone,
        email: state.email,
      })

      const response = await apiClient.sendVerification({
        name: state.name,
        phoneNumber: normalizedPhone,
        email: state.email,
      })

      console.log('Verification response:', response)

      // CRITICAL: Update state with normalized phone number
      setState((prev) => ({
        ...prev,
        phoneNumber: normalizedPhone, // Store the normalized version
        isCodeSent: true,
        isLoading: false,
        error: null,
      }))
      console.log('State before verification:', state);
    } catch (error: any) {
      console.error('Verification error:', error)

      let errorMessage = "Failed to send verification code"

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
    }
  }

  const handleVerifyAndProceed = async () => {
    if (!state.otp.trim()) {
      setState((prev) => ({ ...prev, error: "Please enter the verification code" }));
      return;
    }

    if (state.otp.length !== 6) {
      setState((prev) => ({ ...prev, error: "Please enter a valid 6-digit verification code" }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use the normalized phone number stored in state
      const verifyData = {
        phoneNumber: state.phoneNumber, // Already normalized from handleSendCode
        otp: state.otp,
        email: state.email,
      };

      console.log('Verifying OTP with data:', verifyData);

      const response = await apiClient.verifyCode(verifyData);

      console.log('OTP verification response:', response);

      const { sessionId, voter, expiresAt } = response;

      if (!sessionId) {
        throw new Error('No session ID received from server');
      }

      // Store session info for voting
      localStorage.setItem('votingSession', JSON.stringify({
        sessionId,
        voter,
        timestamp: Date.now(),
        expiresAt,
      }));

      // Clear form state
      setState({
        name: "",
        email: "",
        phoneNumber: "",
        otp: "",
        isCodeSent: false,
        isLoading: false,
        error: null,
      });

      router.push("/vote");
    } catch (error: any) {
      console.error('OTP verification error:', error);
      console.error('Full error object:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });

      let errorMessage = "Invalid verification code";

      if (error.response?.status === 422) {
        errorMessage = error.response?.data?.message || error.response?.data?.error ||
            "Validation failed. Please check your phone number and OTP.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  };

  const handleResendCode = async () => {
    setState((prev) => ({ ...prev, isCodeSent: false, otp: "", error: null }))
    await handleSendCode()
  }

  return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-gradient-to-br from-blue-50 to-yellow-50">
        <Card className="w-full max-w-md mx-4 shadow-lg">
          <CardHeader className="text-center space-y-4">
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
            <CardTitle className="text-2xl font-bold text-gray-900">IMCS-Pax Romana KNUST</CardTitle>
            <CardDescription className="text-gray-600">Voter Verification - Liberation for Peace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {state.error && (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                      id="fullName"
                      type="text"
                      placeholder="Your Full Name"
                      value={state.name}
                      onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
                      className="pl-10"
                      disabled={state.isLoading || state.isCodeSent}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={state.email}
                      onChange={(e) => setState((prev) => ({ ...prev, email: e.target.value }))}
                      className="pl-10"
                      disabled={state.isLoading || state.isCodeSent}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="e.g., +233 24 123 4567 or 0244123456"
                      value={state.phoneNumber}
                      onChange={(e) => setState((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                      className="pl-10"
                      disabled={state.isLoading || state.isCodeSent}
                  />
                </div>
              </div>

              {!state.isCodeSent ? (
                  <Button
                      onClick={handleSendCode}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={state.isLoading}
                  >
                    {state.isLoading ? "Sending..." : "Send Verification Code"}
                  </Button>
              ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="verificationCode">Verification Code</Label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                            id="verificationCode"
                            type="text"
                            placeholder="Enter 6-digit code from SMS"
                            value={state.otp}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                              setState((prev) => ({ ...prev, otp: value }))
                            }}
                            className="pl-10"
                            disabled={state.isLoading}
                            maxLength={6}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                          onClick={handleVerifyAndProceed}
                          className="w-full bg-green-600 hover:bg-green-700"
                          disabled={state.isLoading || state.otp.length !== 6}
                      >
                        {state.isLoading ? "Verifying..." : "Verify & Proceed to Voting"}
                      </Button>

                      <Button
                          onClick={handleResendCode}
                          variant="outline"
                          className="w-full"
                          disabled={state.isLoading}
                      >
                        Resend Code
                      </Button>
                    </div>
                  </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
  )
}