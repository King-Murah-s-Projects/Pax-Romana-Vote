import { type NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"

const secretKey = process.env.JWT_SECRET || "your-secret-key"
const encodedKey = new TextEncoder().encode(secretKey)

export async function POST(request: NextRequest) {
  try {
    const { fullName, phoneNumber, verificationCode } = await request.json()

    // Validate input
    if (!fullName || !phoneNumber || !verificationCode) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // In a real implementation, you would:
    // 1. Verify the code against stored value
    // 2. Check if the code hasn't expired
    // 3. Validate user eligibility to vote
    // 4. Create session/JWT token

    // For demo purposes, accept any 6-digit code
    if (verificationCode.length !== 6 || !/^\d{6}$/.test(verificationCode)) {
      return NextResponse.json({ error: "Invalid verification code format" }, { status: 400 })
    }

    // Create JWT token
    const token = await new SignJWT({
      fullName,
      phoneNumber,
      verified: true,
      voterId: `voter_${Date.now()}`,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(encodedKey)

    return NextResponse.json({
      success: true,
      session: {
        token,
        user: {
          fullName,
          phoneNumber,
          verified: true,
        },
      },
    })
  } catch (error) {
    console.error("Error verifying code:", error)
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 })
  }
}
