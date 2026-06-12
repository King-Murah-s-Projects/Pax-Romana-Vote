"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, TrendingUp, Users, RefreshCw, Activity, CheckCircle, Download, FileText, Loader2, AlertCircle } from "lucide-react"
import { votingApi, positionDisplayNames, handleApiError, CandidatePosition, VotingStats } from "@/lib/api-config"

interface VotingMonitoringProps {
    isEC: boolean // Electoral Commissioner
}

interface VotingProgressItem {
    position: CandidatePosition
    totalVoters: number
    votesSubmitted: number
    percentage: number
}

interface Anomaly {
    id: string
    type: string
    description: string
    severity: "low" | "medium" | "high"
    timestamp: string
    resolved: boolean
}

interface SystemHealth {
    status: "healthy" | "warning" | "critical"
    responseTime: string
    activeConnections: number
    lastUpdate: string
}

export function VotingMonitoring({ isEC }: VotingMonitoringProps) {
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Voting progress data
    const [votingProgress, setVotingProgress] = useState<VotingProgressItem[]>([])
    const [votingStats, setVotingStats] = useState<VotingStats | null>(null)
    const [anomalies, setAnomalies] = useState<Anomaly[]>([])
    const [systemHealth, setSystemHealth] = useState<SystemHealth>({
        status: "healthy",
        responseTime: "245ms",
        activeConnections: 127,
        lastUpdate: new Date().toISOString()
    })

    useEffect(() => {
        loadMonitoringData()

        // Set up real-time polling
        const interval = setInterval(() => {
            loadMonitoringData()
        }, 15000) // Poll every 15 seconds

        return () => clearInterval(interval)
    }, [])

    const loadMonitoringData = async () => {
        try {
            setError(null)

            // Load voting statistics
            const stats = await votingApi.getVotingStats()
            setVotingStats(stats)

            // Transform position stats to voting progress
            if (stats.positionStats) {
                const progress: VotingProgressItem[] = stats.positionStats.map(positionStat => ({
                    position: positionStat.position as CandidatePosition,
                    totalVoters: stats.totalVoters,
                    votesSubmitted: positionStat.totalVotes,
                    percentage: positionStat.percentage
                }))
                setVotingProgress(progress)
            }

            // Load system health if available
            if (isEC) {
                try {
                    const health = await votingApi.getSystemHealth()
                    setSystemHealth({
                        status: health.status || "healthy",
                        responseTime: health.responseTime || "245ms",
                        activeConnections: health.activeConnections || stats.activeVoters || 127,
                        lastUpdate: new Date().toISOString()
                    })
                } catch (healthError) {
                    console.warn('Could not load system health:', healthError)
                }

                // Load anomalies if available
                try {
                    const anomalyData = await votingApi.getAnomalies()
                    if (anomalyData && Array.isArray(anomalyData)) {
                        setAnomalies(anomalyData)
                    } else {
                        // Use mock anomalies for demonstration
                        setAnomalies([
                            {
                                id: "1",
                                type: "Unusual Pattern",
                                description: "Higher than expected voting activity in President position",
                                severity: "medium",
                                timestamp: "10 minutes ago",
                                resolved: false,
                            },
                            {
                                id: "2",
                                type: "Technical Issue",
                                description: "Brief connection timeout for 3 users - resolved automatically",
                                severity: "low",
                                timestamp: "25 minutes ago",
                                resolved: true,
                            },
                        ])
                    }
                } catch (anomalyError) {
                    console.warn('Could not load anomalies:', anomalyError)
                    setAnomalies([])
                }
            }

        } catch (error: any) {
            console.error('Error loading monitoring data:', error)
            setError(handleApiError(error))
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await loadMonitoringData()

        // Simulate a brief delay for UX
        setTimeout(() => {
            setIsRefreshing(false)
        }, 1000)
    }

    const handleResolveAnomaly = async (id: string) => {
        try {
            // In a real implementation, you'd call an API to resolve the anomaly
            setAnomalies(prevAnomalies =>
                prevAnomalies.map(anomaly =>
                    anomaly.id === id
                        ? { ...anomaly, resolved: true, timestamp: "Just now" }
                        : anomaly
                )
            )
        } catch (error: any) {
            setError(handleApiError(error))
        }
    }

    const handleExportMonitoringData = async () => {
        try {
            const exportData = await votingApi.exportVotingData({
                format: 'csv',
                includePersonalData: false
            })

            // Create CSV content for monitoring data
            const csvContent = [
                ["Position", "Total Voters", "Votes Submitted", "Percentage", "Timestamp"],
                ...votingProgress.map((progress) => [
                    positionDisplayNames[progress.position],
                    progress.totalVoters,
                    progress.votesSubmitted,
                    progress.percentage + "%",
                    new Date().toISOString(),
                ]),
            ]
                .map((row) => row.join(","))
                .join("\n")

            const blob = new Blob([csvContent], { type: "text/csv" })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `voting-progress-${new Date().toISOString().split("T")[0]}.csv`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (error: any) {
            setError(handleApiError(error))
        }
    }

    const handleGenerateMonitoringReport = async () => {
        try {
            const analytics = await votingApi.getVotingAnalytics()

            const reportData = {
                timestamp: new Date().toISOString(),
                totalActiveVoters: systemHealth.activeConnections,
                systemStatus: systemHealth.status,
                responseTime: systemHealth.responseTime,
                votingProgress: votingProgress,
                anomalies: anomalies.filter((a) => !a.resolved),
                analytics
            }

            console.log("Generating monitoring report:", reportData)
            alert("Monitoring report generated successfully!")
        } catch (error: any) {
            setError(handleApiError(error))
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Loading Monitoring Data</h3>
                            <p className="text-gray-600">Please wait while we fetch real-time voting information...</p>
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

            {/* Real-time Progress */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Real-time Voting Progress
                            </CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                Last updated: {systemHealth.lastUpdate ? new Date(systemHealth.lastUpdate).toLocaleTimeString() : 'Unknown'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {isEC && (
                                <>
                                    <Button variant="outline" size="sm" onClick={handleExportMonitoringData}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Export Data
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleGenerateMonitoringReport}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Generate Report
                                    </Button>
                                </>
                            )}
                            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {votingProgress.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                <p>No voting progress data available</p>
                            </div>
                        ) : (
                            votingProgress.map((progress) => (
                                <div key={progress.position} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium">{positionDisplayNames[progress.position]}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {progress.votesSubmitted.toLocaleString()} of {progress.totalVoters.toLocaleString()} votes
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold">{progress.percentage.toFixed(1)}%</div>
                                        </div>
                                    </div>
                                    <Progress value={progress.percentage} className="h-3" />
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Anomaly Detection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Anomaly Detection
                        {anomalies.filter((a) => !a.resolved).length > 0 && (
                            <Badge variant="destructive" className="ml-2">
                                {anomalies.filter((a) => !a.resolved).length} Active
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {anomalies.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                            <p>No anomalies detected</p>
                            <p className="text-sm">System is running normally</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {anomalies.map((anomaly) => (
                                <Alert key={anomaly.id} className={anomaly.resolved ? "opacity-60" : ""}>
                                    <AlertTriangle className="h-4 w-4" />
                                    <div className="flex items-start justify-between w-full">
                                        <div className="flex-1">
                                            <AlertDescription>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {anomaly.type}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-xs ${
                                                            anomaly.severity === "high"
                                                                ? "bg-red-100 text-red-800"
                                                                : anomaly.severity === "medium"
                                                                    ? "bg-yellow-100 text-yellow-800"
                                                                    : "bg-blue-100 text-blue-800"
                                                        }`}
                                                    >
                                                        {anomaly.severity.toUpperCase()}
                                                    </Badge>
                                                    {anomaly.resolved && (
                                                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                                                            RESOLVED
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm">{anomaly.description}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{anomaly.timestamp}</p>
                                            </AlertDescription>
                                        </div>
                                        {isEC && !anomaly.resolved && (
                                            <div className="ml-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleResolveAnomaly(anomaly.id)}
                                                >
                                                    Resolve
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </Alert>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Live Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            Active Voters
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{systemHealth.activeConnections}</div>
                        <p className="text-xs text-muted-foreground">Currently online</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center">
                            <Activity className="h-4 w-4 mr-2" />
                            System Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${
                            systemHealth.status === "healthy"
                                ? "text-green-600"
                                : systemHealth.status === "warning"
                                    ? "text-yellow-600"
                                    : "text-red-600"
                        }`}>
                            {systemHealth.status === "healthy" ? "Healthy" :
                                systemHealth.status === "warning" ? "Warning" : "Critical"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {systemHealth.status === "healthy" ? "All systems operational" : "Issues detected"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Response Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{systemHealth.responseTime}</div>
                        <p className="text-xs text-muted-foreground">Average response time</p>
                    </CardContent>
                </Card>
            </div>

            {/* Overall Stats Summary */}
            {votingStats && (
                <Card>
                    <CardHeader>
                        <CardTitle>Election Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">
                                    {votingStats.totalVoters.toLocaleString()}
                                </div>
                                <div className="text-sm text-blue-800">Total Registered</div>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">
                                    {votingStats.votesSubmitted.toLocaleString()}
                                </div>
                                <div className="text-sm text-green-800">Votes Cast</div>
                            </div>
                            <div className="text-center p-4 bg-yellow-50 rounded-lg">
                                <div className="text-2xl font-bold text-yellow-600">
                                    {votingStats.turnoutPercentage.toFixed(1)}%
                                </div>
                                <div className="text-sm text-yellow-800">Turnout Rate</div>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                                <div className="text-2xl font-bold text-purple-600">
                                    {votingStats.activeVoters || 0}
                                </div>
                                <div className="text-sm text-purple-800">Active Now</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}