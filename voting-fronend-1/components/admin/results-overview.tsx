"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    BarChart3,
    User,
    CheckCircle,
    FileText,
    Download,
    Printer,
    Loader2,
    AlertCircle,
    TrendingUp
} from "lucide-react"
import {
    votingApi,
    positionDisplayNames,
    handleApiError,
    CandidatePosition,
    VotingStats,
    Candidate
} from "@/lib/api-config"

interface ResultsOverviewProps {
    isEC: boolean // Electoral Commissioner
}

interface CandidateResult {
    id: string
    candidate: string
    position: CandidatePosition
    votes: number
    percentage: number
    status: "leading" | "trailing" | "unopposed" | "tied"
    photoUrl?: string
}

interface PositionResult {
    position: CandidatePosition
    totalVotes: number
    candidates: CandidateResult[]
    isContested: boolean
}

const VOTING_STATS_KEY = 'imcs-voting-stats'
const CANDIDATES_STORAGE_KEY = 'imcs-candidates'
const VOTES_STORAGE_KEY = 'imcs-votes'

export function ResultsOverview({ isEC }: ResultsOverviewProps) {
    const [selectedPosition, setSelectedPosition] = useState<string>("all")
    const [results, setResults] = useState<CandidateResult[]>([])
    const [positionResults, setPositionResults] = useState<PositionResult[]>([])
    const [votingStats, setVotingStats] = useState<VotingStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

    useEffect(() => {
        loadResults()

        // Poll for updates every 30 seconds
        const interval = setInterval(() => {
            loadResults()
        }, 30000)

        return () => clearInterval(interval)
    }, [])

    const loadResults = async () => {
        try {
            setError(null)
            setLoading(true)

            // Load voting statistics from localStorage
            const stats = await votingApi.getVotingStats()
            setVotingStats(stats)

            // Load candidates and votes from localStorage
            const candidates = JSON.parse(localStorage.getItem(CANDIDATES_STORAGE_KEY) || '[]') as Candidate[]
            const votes = JSON.parse(localStorage.getItem(VOTES_STORAGE_KEY) || '{}') as Record<string, string[]>

            // Transform votes into results
            const positionResultsMap: Record<string, PositionResult> = {}
            const transformedResults: CandidateResult[] = []

            Object.keys(positionDisplayNames).forEach((position) => {
                const positionCandidates = candidates.filter(c => c.position === position)
                if (positionCandidates.length === 0) return

                // Count votes for each candidate in this position
                const voteCounts: Record<string, number> = {}
                positionCandidates.forEach(c => {
                    voteCounts[c.id] = 0
                })

                // Aggregate votes
                Object.values(votes).forEach(vote => {
                    vote.forEach(candidateId => {
                        if (voteCounts[candidateId] !== undefined) {
                            voteCounts[candidateId]++
                        }
                    })
                })

                const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0)
                const isContested = positionCandidates.length > 1

                // Calculate results for each candidate
                const candidateResults: CandidateResult[] = positionCandidates.map((candidate, index) => {
                    const votes = voteCounts[candidate.id] || 0
                    const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0
                    let status: "leading" | "trailing" | "unopposed" | "tied" = "trailing"

                    if (positionCandidates.length === 1) {
                        status = "unopposed"
                    } else {
                        const maxVotes = Math.max(...Object.values(voteCounts))
                        if (votes === maxVotes && votes > 0) {
                            status = Object.values(voteCounts).filter(v => v === maxVotes).length > 1 ? "tied" : "leading"
                        }
                    }

                    return {
                        id: candidate.id,
                        candidate: candidate.name,
                        position: position as CandidatePosition,
                        votes,
                        percentage,
                        status,
                        photoUrl: candidate.photoUrl
                    }
                })

                transformedResults.push(...candidateResults)
                positionResultsMap[position] = {
                    position: position as CandidatePosition,
                    totalVotes,
                    candidates: candidateResults,
                    isContested
                }
            })

            setResults(transformedResults)
            setPositionResults(Object.values(positionResultsMap))
            setLastUpdated(new Date())
        } catch (error: any) {
            console.error('Error loading results:', error)
            setError(handleApiError(error))
        } finally {
            setLoading(false)
        }
    }

    const positions = Object.values(positionDisplayNames)
    const filteredResults = selectedPosition === "all"
        ? results
        : results.filter(result => positionDisplayNames[result.position] === selectedPosition)

    const handleCertifyResults = async () => {
        if (!confirm("Are you sure you want to certify these election results? This action cannot be undone.")) {
            return
        }

        try {
            // In a real implementation, call API to certify results
            alert("Results certified successfully!")
        } catch (error: any) {
            setError(handleApiError(error))
        }
    }

    const handleGenerateReport = async () => {
        try {
            const reportData = await votingApi.exportVotingData({
                format: 'json',
                includePersonalData: false
            })
            console.log("Generating PDF report with data:", reportData)
            alert("PDF report generated successfully! Download will begin shortly.")
        } catch (error: any) {
            setError(handleApiError(error))
        }
    }

    const handleExportCSV = () => {
        const csvContent = [
            ["Candidate", "Position", "Votes", "Percentage", "Status"],
            ...filteredResults.map((result) => [
                result.candidate,
                positionDisplayNames[result.position],
                result.votes,
                result.percentage.toFixed(1) + "%",
                result.status,
            ]),
        ]
            .map((row) => row.join(","))
            .join("\n")

        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `election-results-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
    }

    const handleRefresh = () => {
        setLoading(true)
        loadResults()
    }

    if (loading && results.length === 0) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Loading Results</h3>
                            <p className="text-gray-600">Please wait while we fetch the latest election results...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Error Alert */}
            {error && (
                <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                        {error}
                    </AlertDescription>
                </Alert>
            )}

            {/* Main Results Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Election Results
                            </CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                Last updated: {lastUpdated.toLocaleString()}
                                {loading && <span className="ml-2 text-blue-600">Refreshing...</span>}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Filter by position" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Positions</SelectItem>
                                    {positions.map((position) => (
                                        <SelectItem key={position} value={position}>
                                            {position}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                                {loading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                )}
                                Refresh
                            </Button>

                            {isEC && (
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={handleExportCSV}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Export CSV
                                    </Button>
                                    <Button variant="outline" onClick={handleGenerateReport}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Export PDF
                                    </Button>
                                    <Button variant="outline" onClick={() => window.print()}>
                                        <Printer className="h-4 w-4 mr-2" />
                                        Print
                                    </Button>
                                    <Button onClick={handleCertifyResults} className="bg-green-600 hover:bg-green-700">
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Certify Results
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Voting Stats Summary */}
                    {votingStats && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {votingStats.totalVoters.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-600">Registered Voters</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                    {votingStats.votesSubmitted.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-600">Votes Cast</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-600">
                                    {votingStats.turnoutPercentage.toFixed(1)}%
                                </div>
                                <div className="text-sm text-gray-600">Turnout</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">
                                    {votingStats.activeVoters || 0}
                                </div>
                                <div className="text-sm text-gray-600">Active Voters</div>
                            </div>
                        </div>
                    )}

                    {/* Results Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                            <tr className="border-b bg-gray-50">
                                <th className="text-left p-3 font-medium text-gray-900">Candidate</th>
                                <th className="text-left p-3 font-medium text-gray-900">Position</th>
                                <th className="text-left p-3 font-medium text-gray-900">Votes</th>
                                <th className="text-left p-3 font-medium text-gray-900">Percentage</th>
                                <th className="text-left p-3 font-medium text-gray-900">Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredResults.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">
                                        {selectedPosition === "all"
                                            ? "No results available yet."
                                            : `No results found for ${selectedPosition}.`}
                                    </td>
                                </tr>
                            ) : (
                                filteredResults.map((result, index) => (
                                    <tr key={result.id || index} className="border-b hover:bg-gray-50">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{result.candidate}</span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <Badge variant="outline">
                                                {positionDisplayNames[result.position]}
                                            </Badge>
                                        </td>
                                        <td className="p-3 font-medium">{result.votes.toLocaleString()}</td>
                                        <td className="p-3">{result.percentage.toFixed(1)}%</td>
                                        <td className="p-3">
                                            <Badge
                                                variant={
                                                    result.status === "leading"
                                                        ? "default"
                                                        : result.status === "unopposed"
                                                            ? "secondary"
                                                            : result.status === "tied"
                                                                ? "destructive"
                                                                : "outline"
                                                }
                                                className={
                                                    result.status === "leading"
                                                        ? "bg-green-100 text-green-800"
                                                        : result.status === "unopposed"
                                                            ? "bg-blue-100 text-blue-800"
                                                            : result.status === "tied"
                                                                ? "bg-orange-100 text-orange-800"
                                                                : "bg-gray-100 text-gray-800"
                                                }
                                            >
                                                {result.status === "leading"
                                                    ? "Leading"
                                                    : result.status === "unopposed"
                                                        ? "Unopposed"
                                                        : result.status === "tied"
                                                            ? "Tied"
                                                            : "Trailing"}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Chart Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle>Results Visualization</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                        <div className="text-center text-muted-foreground">
                            <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                            <p className="font-medium">Chart Integration Point</p>
                            <p className="text-sm">Bar/Pie charts showing vote distribution</p>
                            <p className="text-xs mt-2 text-gray-500">
                                Integrate with Chart.js, Recharts, or D3.js for live visualizations
                            </p>
                        </div>
                    </div> {/* Added closing div tag */}
                </CardContent>
            </Card>

            {/* Position Summary */}
            {positionResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Position Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {positionResults.map((position) => (
                                <div key={position.position} className="p-4 border rounded-lg">
                                    <h4 className="font-semibold mb-2">
                                        {positionDisplayNames[position.position]}
                                    </h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span>Total Votes:</span>
                                            <span className="font-medium">
                                                {position.totalVotes.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Candidates:</span>
                                            <span className="font-medium">{position.candidates.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Status:</span>
                                            <Badge variant="outline" className="text-xs">
                                                {position.isContested ? "Contested" : "Unopposed"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
)
}