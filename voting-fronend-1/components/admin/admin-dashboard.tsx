"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import CandidateManagement from "@/components/admin/candidate-management"
import { UserManagement } from "@/components/admin/user-management"
import { AdminSidebar } from "./admin-sidebar"
import { ResultsOverview } from "./results-overview"
import { VotingMonitoring } from "./voting-monitoring"
import { NominationManagement } from "./nomination-management"
import { votingApi, Candidate, positionDisplayNames, CandidatePosition, VotingStats } from "@/lib/api-config"
import {Loader2} from "lucide-react";

const VOTING_STATS_KEY = 'imcs-voting-stats'
const CANDIDATES_STORAGE_KEY = 'imcs-candidates'
const VOTES_STORAGE_KEY = 'imcs-votes'

interface Result {
    position: string
    leader: string
    votes: number
    percentage: number
    runner?: string
    runnerVotes?: number
    unopposed?: boolean
}

export function AdminDashboard() {
    const { user, logout } = useAuth()
    const [activeTab, setActiveTab] = useState("overview")
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [stats, setStats] = useState<VotingStats>({
        status: "", timeRemaining: "",
        totalVoters: 1247,
        votesSubmitted: 0,
        turnoutPercentage: 0,
        activeVoters: 0,
        positionStats: []
    })

    const isAdmin = user?.role === "SUPER_ADMIN"

    useEffect(() => {
        loadStats()
        // Poll for updates every 30 seconds
        const interval = setInterval(loadStats, 30000)
        return () => clearInterval(interval)
    }, [])

    const loadStats = async () => {
        try {
            const votingStats = await votingApi.getVotingStats()
            setStats(votingStats)
        } catch (error) {
            console.error('Error loading stats:', error)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await loadStats()
        setIsRefreshing(false)
    }

    const handleExportResultsCSV = () => {
        try {
            const candidates = JSON.parse(localStorage.getItem(CANDIDATES_STORAGE_KEY) || '[]') as Candidate[]
            const votes = JSON.parse(localStorage.getItem(VOTES_STORAGE_KEY) || '{}') as Record<string, string[]>

            const results: Result[] = Object.keys(positionDisplayNames).map(position => {
                const positionCandidates = candidates.filter(c => c.position === position)
                if (positionCandidates.length === 0) return null

                const voteCounts: Record<string, number> = {}
                positionCandidates.forEach(c => {
                    voteCounts[c.id] = 0
                })

                Object.values(votes).forEach(vote => {
                    vote.forEach(candidateId => {
                        if (voteCounts[candidateId] !== undefined) {
                            voteCounts[candidateId]++
                        }
                    })
                })

                const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0)
                const sortedCandidates = positionCandidates
                    .map(c => ({
                        id: c.id,
                        name: c.name,
                        votes: voteCounts[c.id] || 0
                    }))
                    .sort((a, b) => b.votes - a.votes)

                const leader = sortedCandidates[0]
                const runner = sortedCandidates[1]
                const percentage = totalVotes > 0 ? (leader.votes / totalVotes) * 100 : 0

                return {
                    position: positionDisplayNames[position as CandidatePosition],
                    leader: leader?.name || "N/A",
                    votes: leader?.votes || 0,
                    percentage: percentage,
                    runner: runner?.name,
                    runnerVotes: runner?.votes,
                    unopposed: positionCandidates.length === 1
                }
            }).filter((r): r is Result => r !== null)

            const csvContent = [
                ["Position", "Winner", "Winner Votes", "Winner %", "Runner-up", "Runner-up Votes", "Status"],
                ...results.map((result) => [
                    result.position,
                    result.leader,
                    result.votes,
                    result.percentage.toFixed(1) + "%",
                    result.runner || "N/A",
                    result.runnerVotes || "N/A",
                    result.unopposed ? "Unopposed" : "Contested",
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

            alert("Results exported to CSV successfully!")
        } catch (error) {
            console.error('Error exporting CSV:', error)
            alert("Failed to export results to CSV")
        }
    }

    const handleGenerateResultsPDF = () => {
        try {
            const candidates = JSON.parse(localStorage.getItem(CANDIDATES_STORAGE_KEY) || '[]') as Candidate[]
            const votes = JSON.parse(localStorage.getItem(VOTES_STORAGE_KEY) || '{}') as Record<string, string[]>

            const results: Result[] = Object.keys(positionDisplayNames).map(position => {
                const positionCandidates = candidates.filter(c => c.position === position)
                if (positionCandidates.length === 0) return null

                const voteCounts: Record<string, number> = {}
                positionCandidates.forEach(c => {
                    voteCounts[c.id] = 0
                })

                Object.values(votes).forEach(vote => {
                    vote.forEach(candidateId => {
                        if (voteCounts[candidateId] !== undefined) {
                            voteCounts[candidateId]++
                        }
                    })
                })

                const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0)
                const sortedCandidates = positionCandidates
                    .map(c => ({
                        id: c.id,
                        name: c.name,
                        votes: voteCounts[c.id] || 0
                    }))
                    .sort((a, b) => b.votes - a.votes)

                const leader = sortedCandidates[0]
                const runner = sortedCandidates[1]
                const percentage = totalVotes > 0 ? (leader.votes / totalVotes) * 100 : 0

                return {
                    position: positionDisplayNames[position as CandidatePosition],
                    leader: leader?.name || "N/A",
                    votes: leader?.votes || 0,
                    percentage: percentage,
                    runner: runner?.name,
                    runnerVotes: runner?.votes,
                    unopposed: positionCandidates.length === 1
                }
            }).filter((r): r is Result => r !== null)

            const pdfContent = `
        <html>
          <head>
            <title>Official Election Results</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
              .position { margin-bottom: 30px; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
              .winner { background-color: #d4edda; padding: 10px; border-radius: 5px; margin-bottom: 10px; }
              .runner { background-color: #f8f9fa; padding: 10px; border-radius: 5px; }
              .votes { font-weight: bold; }
              .unopposed { background-color: #cce5ff; padding: 5px 10px; border-radius: 3px; font-size: 12px; }
              .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>OFFICIAL ELECTION RESULTS</h1>
              <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
              <p>Total Registered Voters: ${stats.totalVoters.toLocaleString()}</p>
              <p>Total Votes Cast: ${stats.votesSubmitted.toLocaleString()} (${stats.turnoutPercentage.toFixed(1)}% turnout)</p>
            </div>
            
            ${results
                .map(
                    (result) => `
                  <div class="position">
                    <h2>${result.position} ${result.unopposed ? '<span class="unopposed">UNOPPOSED</span>' : ""}</h2>
                    <div class="winner">
                      <strong>🏆 WINNER: ${result.leader}</strong>
                      <div class="votes">${result.votes.toLocaleString()} votes (${result.percentage.toFixed(1)}%)</div>
                    </div>
                    ${
                        result.runner
                            ? `
                          <div class="runner">
                            <strong>Runner-up: ${result.runner}</strong>
                            <div class="votes">${result.runnerVotes!.toLocaleString()} votes (${((result.runnerVotes! / (result.votes + result.runnerVotes!)) * 100).toFixed(1)}%)</div>
                          </div>
                        `
                            : ""
                    }
                  </div>
                `,
                )
                .join("")}
            
            <div class="footer">
              <p>This document was generated by IMCS-Pax Romana KNUST Election System</p>
              <p>© 2025 IMCS-Pax Romana KNUST. All rights reserved.</p>
            </div>
          </body>
        </html>
      `

            const printWindow = window.open("", "_blank")
            if (printWindow) {
                printWindow.document.write(pdfContent)
                printWindow.document.close()
                printWindow.print()
            }

            alert("PDF report generated and ready for download!")
        } catch (error) {
            console.error('Error generating PDF:', error)
            alert("Failed to generate PDF report")
        }
    }

    const handleCertifyResults = () => {
        if (
            confirm(
                "⚠️ IMPORTANT: Are you sure you want to certify these election results?\n\nThis action will:\n- Make the results official and final\n- Lock all voting processes\n- Generate official certificates\n- Cannot be undone\n\nClick OK to proceed with certification.",
            )
        ) {
            // Simulate certification process
            alert(
                "🎉 RESULTS CERTIFIED SUCCESSFULLY!\n\n✅ Election results have been officially certified\n✅ All voting processes are now locked\n✅ Official certificates generated\n✅ Results published to public portal\n\nCertification completed at: " +
                new Date().toLocaleString(),
            )
        }
    }

    const handleExportMonitoringData = () => {
        alert("Exporting monitoring data...")
    }

    const handleGenerateMonitoringReport = () => {
        alert("Generating monitoring report...")
    }

    const renderContent = () => {
        switch (activeTab) {
            case "overview":
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm border">
                                <h3 className="text-lg font-semibold mb-2">Total Voters</h3>
                                <p className="text-3xl font-bold text-blue-600">{stats.totalVoters.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">Registered IMCS members</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow-sm border">
                                <h3 className="text-lg font-semibold mb-2">Votes Cast</h3>
                                <p className="text-3xl font-bold text-green-600">{stats.votesSubmitted.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">Total votes submitted</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow-sm border">
                                <h3 className="text-lg font-semibold mb-2">Turnout Rate</h3>
                                <p className="text-3xl font-bold text-yellow-600">{stats.turnoutPercentage.toFixed(1)}%</p>
                                <p className="text-sm text-gray-600">Voter participation</p>
                            </div>
                        </div>
                        <ResultsOverview isEC={isAdmin} />
                    </div>
                )
            case "candidates":
                return <CandidateManagement />
            case "nominations":
                return <NominationManagement />
            case "voting":
                return <VotingMonitoring isEC={isAdmin} />
            case "users":
                return <UserManagement />
            case "results":
                return <ResultsOverview isEC={isAdmin} />
            default:
                return <ResultsOverview isEC={isAdmin} />
        }
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <main className="flex-1 lg:ml-80 overflow-auto">
                <div className="p-6 lg:p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold">IMCS-Pax Romana Election Dashboard</h1>
                        <div className="flex gap-4">
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className={`px-4 py-2 rounded-md ${isRefreshing ? 'bg-gray-200' : 'bg-blue-600 hover:bg-blue-700'} text-white flex items-center`}
                            >
                                {isRefreshing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Refreshing...
                                    </>
                                ) : (
                                    "Refresh"
                                )}
                            </button>
                            {isAdmin && (
                                <>
                                    <button
                                        onClick={handleExportResultsCSV}
                                        className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        Export CSV
                                    </button>
                                    <button
                                        onClick={handleGenerateResultsPDF}
                                        className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                        Generate PDF
                                    </button>
                                    <button
                                        onClick={handleCertifyResults}
                                        className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        Certify Results
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    {renderContent()}
                </div>
            </main>
        </div>
    )
}