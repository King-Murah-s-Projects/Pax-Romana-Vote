import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
    title: "IMCS-Pax Romana KNUST Elections",
    description: "Digital voting platform for IMCS-Pax Romana KNUST elections - Liberation for Peace",
    keywords: ["IMCS", "Pax Romana", "KNUST", "elections", "voting", "Catholic students"],
}

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
        <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
        </body>
        </html>
    )
}
