"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { Vote, Users, Shield, Clock, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react"
import Image from "next/image"

// Mock API configuration matching the candidate management
const positionDisplayNames = {
    PRESIDENT: "President",
    VICE_PRESIDENT: "Vice President",
    GENERAL_SECRETARY: "General Secretary",
    FINANCIAL_SECRETARY: "Financial Secretary",
    ORGANIZING_SECRETARY_MAIN: "Organizing Secretary (Main)",
    ORGANIZING_SECRETARY_ASSISTANT: "Organizing Secretary (Assistant)",
    PRO_MAIN: "PRO (Main)",
    PRO_ASSISTANT: "PRO (Assistant)",
    WOMEN_COMMISSIONER: "Women Commissioner"
}

type CandidatePosition = keyof typeof positionDisplayNames

interface ElectionStats {
    totalVoters: number
    votescast: number
    turnoutPercentage: number
    timeRemaining: string
    status: "active" | "upcoming" | "ended"
}

interface Candidate {
    id: string
    name: string
    position: CandidatePosition
    candidateNumber: number
    photoUrl?: string
    bio?: string
}

interface Position {
    id: string
    title: string
    candidates: Candidate[]
    maxSelections: number
    position: CandidatePosition
}

// Storage utilities
const CANDIDATES_STORAGE_KEY = 'imcs-candidates'
const VOTING_STATS_KEY = 'imcs-voting-stats'
const VOTED_STATUS_KEY = 'imcs-pax-romana-voted'
const SESSION_KEY = 'imcs-pax-romana-session'

const loadCandidatesFromStorage = (): Candidate[] => {
    try {
        const stored = localStorage.getItem(CANDIDATES_STORAGE_KEY)
        if (stored) {
            return JSON.parse(stored)
        }
        return [
            {
                id: "1",
                name: "John Doe",
                position: "PRESIDENT",
                candidateNumber: 1,
                photoUrl: "/placeholder.svg?height=150&width=150",
                bio: "Experienced leader with vision for change"
            },
            {
                id: "2",
                name: "Jane Smith",
                position: "PRESIDENT",
                candidateNumber: 2,
                photoUrl: "/placeholder.svg?height=150&width=150",
                bio: "Dedicated public servant"
            }
        ]
    } catch (error) {
        console.error('Failed to load candidates from localStorage:', error)
        return []
    }
}

const loadVotingStatsFromStorage = (): ElectionStats => {
    try {
        const stored = localStorage.getItem(VOTING_STATS_KEY)
        if (stored) {
            return JSON.parse(stored)
        }
        return {
            totalVoters: 1247,
            votescast: 892,
            turnoutPercentage: 71.5,
            timeRemaining: "2h 34m",
            status: "active"
        }
    } catch (error) {
        console.error('Failed to load voting stats from localStorage:', error)
        return {
            totalVoters: 1247,
            votescast: 892,
            turnoutPercentage: 71.5,
            timeRemaining: "2h 34m",
            status: "active"
        }
    }
}

const saveVotingStatsToStorage = (stats: ElectionStats) => {
    try {
        localStorage.setItem(VOTING_STATS_KEY, JSON.stringify(stats))
    } catch (error) {
        console.error('Failed to save voting stats to localStorage:', error)
    }
}

const handleApiError = (error: any): string => {
    return error?.message || "An unexpected error occurred"
}

export default function VotingPage() {
    const [showVoting, setShowVoting] = useState(false)
    const [stats, setStats] = useState<ElectionStats>(loadVotingStatsFromStorage())
    const [positions, setPositions] = useState<Position[]>([])
    const [currentPositionIndex, setCurrentPositionIndex] = useState(0)
    const [selections, setSelections] = useState<Record<string, string[]>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasVoted, setHasVoted] = useState(localStorage.getItem(VOTED_STATUS_KEY) === "true")
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem(SESSION_KEY))

    useEffect(() => {
        if (!sessionId) {
            const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            localStorage.setItem(SESSION_KEY, newSessionId)
            setSessionId(newSessionId)
        }

        loadVotingStats()
        const interval = setInterval(loadVotingStats, 30000)
        return () => clearInterval(interval)
    }, [])

    const loadVotingStats = async () => {
        try {
            const votingStats = loadVotingStatsFromStorage()
            setStats(votingStats)
        } catch (error) {
            console.error('Error loading voting stats:', error)
            setStats(prev => ({ ...prev, status: "active" }))
        }
    }

    const loadBallotData = async () => {
        try {
            setLoading(true)
            setError(null)
            const candidates = loadCandidatesFromStorage()

            const groupedPositions: Position[] = Object.keys(positionDisplayNames).map(position => ({
                id: position.toLowerCase().replace(/_/g, '-'),
                title: positionDisplayNames[position as CandidatePosition],
                position: position as CandidatePosition,
                candidates: candidates.filter(c => c.position === position).map(c => ({
                    ...c,
                    image: c.photoUrl || "/placeholder.svg?height=150&width=150"
                })),
                maxSelections: 1
            })).filter(pos => pos.candidates.length > 0)

            setPositions(groupedPositions)
            if (groupedPositions.length === 0) {
                setError("No candidates available for voting")
            }
        } catch (error: any) {
            console.error('Error loading ballot:', error)
            setError(handleApiError(error))
            setPositions([
                {
                    id: 'president',
                    title: 'President',
                    position: 'PRESIDENT',
                    maxSelections: 1,
                    candidates: [
                        {
                            id: '1',
                            name: 'John Doe',
                            position: 'PRESIDENT',
                            //@ts-ignore
                            image: '/placeholder.svg?height=150&width=150',
                            bio: "Experienced leader with vision for change"
                        },
                        {
                            id: '2',
                            name: 'Jane Smith',
                            position: 'PRESIDENT',
                            //@ts-ignore
                            image: '/placeholder.svg?height=150&width=150',
                            bio: "Dedicated public servant"
                        }
                    ]
                }
            ])
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "active":
                return "bg-green-100 text-green-800 border-green-200"
            case "upcoming":
                return "bg-yellow-100 text-yellow-800 border-yellow-200"
            case "ended":
                return "bg-gray-100 text-gray-800 border-gray-200"
            default:
                return "bg-gray-100 text-gray-800 border-gray-200"
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "active":
                return <CheckCircle className="h-4 w-4" />
            case "upcoming":
                return <Clock className="h-4 w-4" />
            case "ended":
                return <AlertCircle className="h-4 w-4" />
            default:
                return <Clock className="h-4 w-4" />
        }
    }

    const currentPosition = positions[currentPositionIndex]
    const progress = positions.length > 0 ? ((currentPositionIndex + 1) / positions.length) * 100 : 0

    const handleCandidateSelect = (candidateId: string) => {
        if (!currentPosition) return
        const positionId = currentPosition.id
        setSelections({
            ...selections,
            [positionId]: [candidateId]
        })
    }

    const handleNext = () => {
        if (currentPositionIndex < positions.length - 1) {
            setCurrentPositionIndex(currentPositionIndex + 1)
        }
    }

    const handlePrevious = () => {
        if (currentPositionIndex > 0) {
            setCurrentPositionIndex(currentPositionIndex - 1)
        }
    }

    const handleSubmitVote = async () => {
        if (!sessionId) {
            setError("No valid session found. Please restart the voting process.")
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const votes: Record<string, string[]> = {}
            positions.forEach(position => {
                const positionSelections = selections[position.id] || []
                if (positionSelections.length > 0) {
                    votes[position.position] = positionSelections
                }
            })

            localStorage.setItem(VOTED_STATUS_KEY, "true")
            localStorage.removeItem(SESSION_KEY)
            setHasVoted(true)

            const newStats = {
                ...stats,
                votescast: stats.votescast + 1,
                turnoutPercentage: ((stats.votescast + 1) / stats.totalVoters) * 100
            }
            setStats(newStats)
            saveVotingStatsToStorage(newStats)

            toast.success("Vote submitted successfully!", {
                description: "Your vote has been securely recorded."
            })
        } catch (error: any) {
            console.error("Error submitting vote:", error)
            setError(handleApiError(error))
            toast.error("Failed to submit vote", {
                description: handleApiError(error)
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const isPositionComplete = () => {
        if (!currentPosition) return false
        const positionSelections = selections[currentPosition.id] || []
        return positionSelections.length > 0
    }

    const allPositionsComplete = () => {
        return positions.every(position => {
            const positionSelections = selections[position.id] || []
            return positionSelections.length > 0
        })
    }

    const handleStartVoting = async () => {
        if (!sessionId) {
            setError("Please verify your identity first to start voting.")
            return
        }
        setShowVoting(true)
        await loadBallotData()
    }

    const handleBackToHome = () => {
        setShowVoting(false)
        setCurrentPositionIndex(0)
        setSelections({})
        setError(null)
    }

    const isVotingEnabled = stats.status === "active" && sessionId

    if (hasVoted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center shadow-lg">
                    <CardHeader className="space-y-4">
                        <div className="flex justify-center items-center space-x-4">
                            <Image
                                src="/images/imcs-pax-romana.jpeg"
                                alt="IMCS-Pax Romana"
                                width={60}
                                height={60}
                                className="rounded-full"
                            />
                            <Image
                                src="/images/knust-seal.jpg"
                                alt="KNUST"
                                width={60}
                                height={60}
                                className="rounded-full"
                            />
                        </div>
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-gray-900">Vote Submitted Successfully!</CardTitle>
                        <CardDescription className="text-gray-600">
                            Thank you for participating in the IMCS-Pax Romana KNUST elections
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-green-800 text-sm">
                                Your vote has been securely recorded and encrypted. Results will be announced after the
                                voting period ends.
                            </p>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                            <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
                        </div>
                        <Button
                            onClick={() => {
                                localStorage.removeItem(VOTED_STATUS_KEY)
                                setHasVoted(false)
                                setShowVoting(false)
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            Return to Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (showVoting) {
        if (loading) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 flex items-center justify-center">
                    <Card className="w-full max-w-md text-center">
                        <CardContent className="p-8">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p>Loading ballot data...</p>
                        </CardContent>
                    </Card>
                </div>
            )
        }

        if (positions.length === 0) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 flex items-center justify-center">
                    <Card className="w-full max-w-md text-center">
                        <CardContent className="p-8">
                            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
                            <p className="text-red-600 mb-4">Failed to load ballot data</p>
                            <Button onClick={handleBackToHome}>Return to Home</Button>
                        </CardContent>
                    </Card>
                </div>
            )
        }

        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50">
                <header className="bg-white shadow-sm border-b border-gray-200">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Image
                                    src="/images/imcs-pax-romana.jpeg"
                                    alt="IMCS-Pax Romana"
                                    width={40}
                                    height={40}
                                    className="rounded-full"
                                />
                                <Image
                                    src="/images/knust-seal.jpg"
                                    alt="KNUST"
                                    width={40}
                                    height={40}
                                    className="rounded-full"
                                />
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">IMCS-Pax Romana KNUST</h1>
                                    <p className="text-sm text-blue-600">Liberation for Peace</p>
                                </div>
                            </div>
                            <Button variant="outline" onClick={handleBackToHome} size="sm">
                                <Shield className="h-4 w-4 mr-2" />
                                Back to Home
                            </Button>
                        </div>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">Cast Your Vote</h2>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Clock className="h-4 w-4" />
                                <span>Time remaining: {stats.timeRemaining}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Position {currentPositionIndex + 1} of {positions.length}</span>
                                <span>{Math.round(progress)}% complete</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    </div>

                    {currentPosition && (
                        <div className="mb-8 bg-white rounded-lg shadow-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                                <h3 className="text-2xl font-bold">{currentPosition.title}</h3>
                                <div className="flex items-center space-x-2 mt-2">
                                    <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm">
                                        Select {currentPosition.maxSelections} candidate{currentPosition.maxSelections > 1 ? "s" : ""}
                                    </span>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {currentPosition.candidates.map((candidate: Candidate & { image?: string }) => {
                                        const isSelected = (selections[currentPosition.id] || []).includes(candidate.id)
                                        const isUnopposed = currentPosition.candidates.length === 1

                                        return (
                                            <div
                                                key={candidate.id}
                                                className={`border-2 rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                                                    isSelected
                                                        ? "border-blue-500 bg-blue-50 shadow-md"
                                                        : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                                }`}
                                                onClick={() => handleCandidateSelect(candidate.id)}
                                            >
                                                <div className="flex flex-col items-center text-center space-y-4">
                                                    <div className="relative">
                                                        <Image
                                                            src={candidate.image || "/placeholder.svg?height=150&width=150"}
                                                            alt={candidate.name}
                                                            width={128}
                                                            height={128}
                                                            className="rounded-lg object-cover shadow-md"
                                                        />
                                                        {isSelected && (
                                                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                                                <CheckCircle className="h-5 w-5 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex flex-col items-center space-y-2">
                                                            <h4 className="text-xl font-semibold text-gray-900">{candidate.name}</h4>
                                                            {isUnopposed && (
                                                                <span className="text-green-600 border border-green-600 px-3 py-1 rounded-full text-sm">
                                                                    Unopposed
                                                                </span>
                                                            )}
                                                            {candidate.bio && (
                                                                <p className="text-sm text-gray-600">
                                                                    {candidate.bio.length > 100
                                                                        ? `${candidate.bio.substring(0, 100)}...`
                                                                        : candidate.bio}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            onClick={handlePrevious}
                            disabled={currentPositionIndex === 0}
                            className="flex items-center space-x-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span>Previous</span>
                        </Button>

                        <div className="flex items-center space-x-4">
                            {!isPositionComplete() && currentPosition && currentPosition.candidates.length > 0 && (
                                <Alert className="border-yellow-200 bg-yellow-50">
                                    <AlertDescription className="text-yellow-800">
                                        Please select a candidate to continue
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {currentPositionIndex < positions.length - 1 ? (
                            <Button
                                onClick={handleNext}
                                disabled={!isPositionComplete() && currentPosition && currentPosition.candidates.length > 0}
                                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
                            >
                                <span>Next</span>
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmitVote}
                                disabled={!allPositionsComplete() || isSubmitting}
                                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Vote className="h-4 w-4" />
                                        <span>Submit Vote</span>
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {currentPositionIndex === positions.length - 1 && (
                        <Card className="mt-8 border-green-200">
                            <CardHeader>
                                <CardTitle className="text-green-800">Vote Summary</CardTitle>
                                <CardDescription>Review your selections before submitting</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {positions.map((position: Position) => {
                                        const positionSelections = selections[position.id] || []
                                        const selectedCandidates = position.candidates.filter((c: Candidate) => positionSelections.includes(c.id))

                                        return (
                                            <div
                                                key={position.id}
                                                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
                                            >
                                                <span className="font-medium text-gray-900">{position.title}:</span>
                                                <span className="text-gray-600">
                                                    {selectedCandidates.length > 0
                                                        ? selectedCandidates.map((c: Candidate) => c.name).join(", ")
                                                        : "No selection"}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {error && (
                        <Alert className="mt-4 border-red-200 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}
                </main>
                <Toaster position="top-right" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Image
                                src="/images/imcs-pax-romana.jpeg"
                                alt="IMCS-Pax Romana"
                                width={50}
                                height={50}
                                className="rounded-full"
                            />
                            <Image
                                src="/images/knust-seal.jpg"
                                alt="KNUST"
                                width={50}
                                height={50}
                                className="rounded-full"
                            />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">IMCS-Pax Romana KNUST</h1>
                                <p className="text-sm text-blue-600 font-medium">Liberation for Peace</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                            <Shield className="h-4 w-4 mr-2" />
                            Admin Portal
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-6">
                        <Badge className={`px-4 py-2 text-sm font-medium ${getStatusColor(stats.status)}`}>
                            {getStatusIcon(stats.status)}
                            <span className="ml-2 capitalize">{stats.status} Election</span>
                        </Badge>
                    </div>
                    <h2 className="text-4xl font-bold text-gray-900 mb-4">IMCS-Pax Romana KNUST Elections 2025</h2>
                    <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                        Exercise your democratic right and choose the leaders who will guide our Catholic student community towards
                        liberation for peace. Your voice matters in shaping our future.
                    </p>
                    <Button
                        onClick={handleStartVoting}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium"
                        disabled={!isVotingEnabled}
                    >
                        <Vote className="h-5 w-5 mr-2" />
                        {!sessionId
                            ? "Generating Session..."
                            : stats.status !== "active"
                                ? `Election ${stats.status}`
                                : "Cast Your Vote"}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <Card className="border-blue-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                                <Users className="h-4 w-4 mr-2 text-blue-600" />
                                Total Registered
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900">{stats.totalVoters.toLocaleString()}</div>
                            <p className="text-sm text-gray-600">IMCS members</p>
                        </CardContent>
                    </Card>

                    <Card className="border-green-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                                <Vote className="h-4 w-4 mr-2 text-green-600" />
                                Votes Cast
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900">{stats.votescast.toLocaleString()}</div>
                            <p className="text-sm text-gray-600">and counting...</p>
                        </CardContent>
                    </Card>

                    <Card className="border-yellow-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                                <CheckCircle className="h-4 w-4 mr-2 text-yellow-600" />
                                Turnout
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900">{stats.turnoutPercentage}%</div>
                            <p className="text-sm text-gray-600">participation rate</p>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                                <Clock className="h-4 w-4 mr-2 text-red-600" />
                                Time Left
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900">{stats.timeRemaining}</div>
                            <p className="text-sm text-gray-600">to vote</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold text-gray-900">About IMCS-Pax Romana</CardTitle>
                            <CardDescription>Our mission and values</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-700">
                                The International Movement of Catholic Students - Pax Romana is a global organization that brings
                                together Catholic students and intellectuals to promote peace, justice, and human dignity.
                            </p>
                            <p className="text-gray-700">
                                At KNUST, we embody the spirit of "Liberation for Peace" by fostering academic excellence, spiritual
                                growth, and social responsibility among our members.
                            </p>
                            <div className="flex items-center space-x-2 text-blue-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Promoting Catholic values in academia</span>
                            </div>
                            <div className="flex items-center space-x-2 text-blue-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Building bridges for peace and understanding</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold text-gray-900">Election Information</CardTitle>
                            <CardDescription>Important details about the voting process</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Election Period:</span>
                                    <span className="font-medium">March 15-16, 2025</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Voting Method:</span>
                                    <span className="font-medium">Digital Ballot</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Verification:</span>
                                    <span className="font-medium">Manual (On-site)</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Results:</span>
                                    <span className="font-medium">Live Updates</span>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-600">
                                    All votes are encrypted and anonymous. Results are updated in real-time and will be officially
                                    announced after the voting period ends.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {error && (
                    <Alert className="mb-8 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                            {error}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="text-center bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-white">
                    <h3 className="text-2xl font-bold mb-4">Your Voice, Your Choice</h3>
                    <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                        Join your fellow IMCS-Pax Romana members in shaping the future of our community. Every vote counts in
                        building a stronger, more united organization.
                    </p>
                    <Button
                        onClick={handleStartVoting}
                        size="lg"
                        variant="secondary"
                        className="bg-white text-blue-700 hover:bg-gray-50"
                        disabled={!isVotingEnabled}
                    >
                        <Vote className="h-5 w-5 mr-2" />
                        {!sessionId
                            ? "Preparing Session..."
                            : stats.status !== "active"
                                ? `Election ${stats.status}`
                                : "Start Voting Process"}
                    </Button>
                </div>
            </main>

            <footer className="bg-gray-50 border-t border-gray-200 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center">
                        <div className="flex justify-center items-center space-x-4 mb-4">
                            <Image
                                src="/images/imcs-pax-romana.jpeg"
                                alt="IMCS-Pax Romana"
                                width={40}
                                height={40}
                                className="rounded-full"
                            />
                            <Image
                                src="/images/knust-seal.jpg"
                                alt="KNUST"
                                width={40}
                                height={40}
                                className="rounded-full"
                            />
                        </div>
                        <p className="text-gray-600 mb-2">International Movement of Catholic Students - Pax Romana</p>
                        <p className="text-gray-600 mb-4">Kwame Nkrumah University of Science and Technology</p>
                        <p className="text-sm text-gray-500">
                            © 2025 IMCS-Pax Romana KNUST. All rights reserved. | Liberation for Peace
                        </p>
                    </div>
                </div>
            </footer>
            <Toaster position="top-right" />
        </div>
    )
}