// "use client"
//
// import { useState, useEffect } from "react"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Progress } from "@/components/ui/progress"
// import { CheckCircle, Clock, Vote, ArrowRight, ArrowLeft, Shield, Loader2, User, Phone, Mail } from "lucide-react"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { useRouter } from "next/navigation"
// import Image from "next/image"
// import { votingApi, handleApiError, apiClient, type Position, type Candidate, type BallotResponse } from "@/lib/api-config"
//
// interface VotingInterfaceProps {
//     positions?: Position[]
// }
//
// // Voter verification state
// interface VerificationState {
//     name: string
//     email: string
//     phoneNumber: string
//     otp: string
//     isCodeSent: boolean
//     isLoading: boolean
//     error: string | null
// }
//
// // User interface for voting
// interface VotingUser {
//     id: string
//     name: string
//     email: string
//     phoneNumber?: string
//     sessionId?: string
// }
//
// export function VotingInterface({ positions }: VotingInterfaceProps) {
//     const router = useRouter()
//
//     // Authentication states
//     const [isAuthenticated, setIsAuthenticated] = useState(false)
//     const [user, setUser] = useState<VotingUser | null>(null)
//     const [verification, setVerification] = useState<VerificationState>({
//         name: "",
//         email: "",
//         phoneNumber: "",
//         otp: "",
//         isCodeSent: false,
//         isLoading: false,
//         error: null,
//     })
//
//     // Voting states
//     const [currentPositionIndex, setCurrentPositionIndex] = useState(0)
//     const [selections, setSelections] = useState<Record<string, string[]>>({})
//     const [isSubmitting, setIsSubmitting] = useState(false)
//     const [hasVoted, setHasVoted] = useState(false)
//     const [timeRemaining, setTimeRemaining] = useState("Loading...")
//     const [ballotData, setBallotData] = useState<Position[]>([])
//     const [loading, setLoading] = useState(false)
//     const [error, setError] = useState<string | null>(null)
//
//     // Phone number normalization
//     const normalizePhoneNumber = (phone: string): string => {
//         const digitsOnly = phone.replace(/\D/g, '');
//         if (digitsOnly.startsWith('233')) {
//             return digitsOnly;
//         } else if (digitsOnly.startsWith('0')) {
//             return '233' + digitsOnly.substring(1);
//         } else if (digitsOnly.length === 9) {
//             return '233' + digitsOnly;
//         }
//         return digitsOnly;
//     };
//
//     // Check for existing session on component mount
//     useEffect(() => {
//         const storedSession = localStorage.getItem('votingSession');
//         if (storedSession) {
//             try {
//                 const sessionData = JSON.parse(storedSession);
//                 if (sessionData.sessionId && sessionData.voter) {
//                     setUser({
//                         id: sessionData.voter.id || 'anonymous',
//                         name: sessionData.voter.name || sessionData.voter,
//                         email: sessionData.voter.email || '',
//                         phoneNumber: sessionData.voter.phoneNumber,
//                         sessionId: sessionData.sessionId
//                     });
//                     setIsAuthenticated(true);
//                 }
//             } catch (error) {
//                 console.error('Error parsing stored session:', error);
//                 localStorage.removeItem('votingSession');
//             }
//         }
//     }, []);
//
//     // Load ballot data when authenticated
//     useEffect(() => {
//         const initializeVoting = async () => {
//             if (!isAuthenticated || !user?.sessionId) return;
//
//             try {
//                 setLoading(true);
//                 setError(null);
//
//                 // Check if user has already voted
//                 const votedStatus = localStorage.getItem(`imcs-pax-romana-voted-${user?.id}`);
//                 if (votedStatus === "true") {
//                     setHasVoted(true);
//                     setLoading(false);
//                     return;
//                 }
//
//                 // Validate session
//                 try {
//                     const sessionValidation = await votingApi.validateSession(user.sessionId);
//                     if (!sessionValidation.valid) {
//                         throw new Error(sessionValidation.message || "Invalid session");
//                     }
//                 } catch (err) {
//                     console.error("Session validation failed:", err);
//                     handleLogout();
//                     return;
//                 }
//
//                 // Fetch ballot data
//                 try {
//                     const ballotResponse: BallotResponse = await votingApi.getBallot();
//                     if (ballotResponse && ballotResponse.positions && Array.isArray(ballotResponse.positions)) {
//                         setBallotData(ballotResponse.positions);
//                         if (ballotResponse.timeRemaining) {
//                             setTimeRemaining(ballotResponse.timeRemaining);
//                         }
//                     } else if (ballotResponse && Array.isArray(ballotResponse)) {
//                         setBallotData(ballotResponse as unknown as Position[]);
//                     } else {
//                         setBallotData(positions || []);
//                     }
//                 } catch (ballotError) {
//                     console.warn("Could not fetch ballot:", ballotError);
//                     setBallotData(positions || []);
//                     if (positions && positions.length === 0) {
//                         setError("No ballot data available");
//                     }
//                 }
//
//             } catch (err) {
//                 console.error("Error initializing voting:", err);
//                 setError(handleApiError(err));
//             } finally {
//                 setLoading(false);
//             }
//         };
//
//         initializeVoting();
//     }, [isAuthenticated, user, positions]);
//
//     // Verification handlers
//     const handleSendCode = async () => {
//         if (!verification.name.trim() || !verification.email.trim() || !verification.phoneNumber.trim()) {
//             setVerification(prev => ({ ...prev, error: "Please fill in all required fields" }));
//             return;
//         }
//
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//         if (!emailRegex.test(verification.email)) {
//             setVerification(prev => ({ ...prev, error: "Please enter a valid email address" }));
//             return;
//         }
//
//         const normalizedPhone = normalizePhoneNumber(verification.phoneNumber);
//         if (normalizedPhone.length < 12) {
//             setVerification(prev => ({ ...prev, error: "Please enter a valid Ghanaian phone number" }));
//             return;
//         }
//
//         setVerification(prev => ({ ...prev, isLoading: true, error: null }));
//
//         try {
//             await apiClient.sendVerification({
//                 name: verification.name,
//                 phoneNumber: normalizedPhone,
//                 email: verification.email,
//             });
//
//             setVerification(prev => ({
//                 ...prev,
//                 phoneNumber: normalizedPhone,
//                 isCodeSent: true,
//                 isLoading: false,
//                 error: null,
//             }));
//         } catch (error: any) {
//             console.error('Verification error:', error);
//             setVerification(prev => ({
//                 ...prev,
//                 isLoading: false,
//                 error: error.response?.data?.message || error.message || "Failed to send verification code",
//             }));
//         }
//     };
//
//     const handleVerifyAndProceed = async () => {
//         if (!verification.otp.trim() || verification.otp.length !== 6) {
//             setVerification(prev => ({ ...prev, error: "Please enter a valid 6-digit verification code" }));
//             return;
//         }
//
//         setVerification(prev => ({ ...prev, isLoading: true, error: null }));
//
//         try {
//             const response = await apiClient.verifyCode({
//                 phoneNumber: verification.phoneNumber,
//                 otp: verification.otp,
//                 email: verification.email,
//             });
//
//             const { sessionId, voter, expiresAt } = response;
//
//             if (!sessionId) {
//                 throw new Error('No session ID received from server');
//             }
//
//             // Store session info
//             localStorage.setItem('votingSession', JSON.stringify({
//                 sessionId,
//                 voter,
//                 timestamp: Date.now(),
//                 expiresAt,
//             }));
//
//             // Set user and authenticate
//             setUser({
//                 //@ts-ignore
//                 id: voter.id || 'anonymous',
//                 //@ts-ignore
//                 name: voter.name || verification.name,
//                 //@ts-ignore
//                 email: voter.email || verification.email,
//                 phoneNumber: verification.phoneNumber,
//                 sessionId
//             });
//
//             setIsAuthenticated(true);
//
//             // Clear verification state
//             setVerification({
//                 name: "",
//                 email: "",
//                 phoneNumber: "",
//                 otp: "",
//                 isCodeSent: false,
//                 isLoading: false,
//                 error: null,
//             });
//
//         } catch (error: any) {
//             console.error('OTP verification error:', error);
//             setVerification(prev => ({
//                 ...prev,
//                 isLoading: false,
//                 error: error.response?.data?.message || "Invalid verification code",
//             }));
//         }
//     };
//
//     const handleResendCode = async () => {
//         setVerification(prev => ({ ...prev, isCodeSent: false, otp: "", error: null }));
//         await handleSendCode();
//     };
//
//     // Voting handlers
//     const currentPosition = ballotData[currentPositionIndex];
//     const progress = ballotData.length > 0 ? ((currentPositionIndex + 1) / ballotData.length) * 100 : 0;
//
//     const handleCandidateSelect = (candidateId: string) => {
//         if (!currentPosition) return;
//
//         const positionId = currentPosition.id;
//         const currentSelections = selections[positionId] || [];
//
//         if (currentPosition.maxSelections === 1) {
//             setSelections({
//                 ...selections,
//                 [positionId]: [candidateId],
//             });
//         } else {
//             if (currentSelections.includes(candidateId)) {
//                 setSelections({
//                     ...selections,
//                     [positionId]: currentSelections.filter((id) => id !== candidateId),
//                 });
//             } else if (currentSelections.length < currentPosition.maxSelections) {
//                 setSelections({
//                     ...selections,
//                     [positionId]: [...currentSelections, candidateId],
//                 });
//             }
//         }
//     };
//
//     const handleNext = () => {
//         if (currentPositionIndex < ballotData.length - 1) {
//             setCurrentPositionIndex(currentPositionIndex + 1);
//         }
//     };
//
//     const handlePrevious = () => {
//         if (currentPositionIndex > 0) {
//             setCurrentPositionIndex(currentPositionIndex - 1);
//         }
//     };
//
//     const handleSubmitVote = async () => {
//         if (!user?.sessionId) {
//             setError("No valid session found. Please log in again.");
//             return;
//         }
//
//         setIsSubmitting(true);
//         setError(null);
//
//         try {
//             const votes: Record<string, string[]> = {};
//             ballotData.forEach(position => {
//                 const positionSelections = selections[position.id] || [];
//                 if (positionSelections.length > 0) {
//                     votes[position.id] = positionSelections;
//                 }
//             });
//
//             const result = await votingApi.submitVote({
//                 sessionId: user.sessionId,
//                 votes
//             });
//
//             if (result.success !== false) {
//                 localStorage.setItem(`imcs-pax-romana-voted-${user?.id}`, "true");
//                 setHasVoted(true);
//                 console.log("Vote submitted successfully:", result);
//             } else {
//                 throw new Error(result.message || "Failed to submit vote");
//             }
//         } catch (error) {
//             console.error("Error submitting vote:", error);
//             setError(handleApiError(error));
//         } finally {
//             setIsSubmitting(false);
//         }
//     };
//
//     const handleLogout = () => {
//         localStorage.removeItem('votingSession');
//         localStorage.removeItem(`imcs-pax-romana-voted-${user?.id}`);
//         setUser(null);
//         setIsAuthenticated(false);
//         router.push("/");
//     };
//
//     const isPositionComplete = () => {
//         if (!currentPosition) return false;
//         const positionSelections = selections[currentPosition.id] || [];
//         return positionSelections.length > 0;
//     };
//
//     const allPositionsComplete = () => {
//         return ballotData.every((position) => {
//             const positionSelections = selections[position.id] || [];
//             return positionSelections.length > 0;
//         });
//     };
//
//     // Show a verification form if not authenticated
//     if (!isAuthenticated) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50">
//                 {/* Header */}
//                 <header className="bg-white shadow-sm border-b border-gray-200">
//                     <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
//                         <div className="flex items-center justify-between">
//                             <div className="flex items-center space-x-4">
//                                 <Image
//                                     src="/images/imcs-pax-romana.jpeg"
//                                     alt="IMCS-Pax Romana"
//                                     width={40}
//                                     height={40}
//                                     className="rounded-full"
//                                 />
//                                 <Image
//                                     src="/images/Knust_seal.jpg"
//                                     alt="KNUST"
//                                     width={40}
//                                     height={40}
//                                     className="rounded-full"
//                                 />
//                                 <div>
//                                     <h1 className="text-xl font-bold text-gray-900">IMCS-Pax Romana KNUST</h1>
//                                     <p className="text-sm text-blue-600">Liberation for Peace</p>
//                                 </div>
//                             </div>
//                             <Button variant="outline" onClick={() => router.push("/")} size="sm">
//                                 <Shield className="h-4 w-4 mr-2" />
//                                 Back to Home
//                             </Button>
//                         </div>
//                     </div>
//                 </header>
//
//                 {/* Verification Form */}
//                 <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8">
//                     <Card className="w-full max-w-md mx-4 shadow-lg">
//                         <CardHeader className="text-center space-y-4">
//                             <div className="flex justify-center items-center space-x-4">
//                                 <Image
//                                     src="/images/imcs-pax-romana.jpeg"
//                                     alt="IMCS-Pax Romana"
//                                     width={60}
//                                     height={60}
//                                     className="rounded-full"
//                                 />
//                                 <Image src="/images/Knust_seal.jpg" alt="KNUST" width={60} height={60} className="rounded-full" />
//                             </div>
//                             <CardTitle className="text-2xl font-bold text-gray-900">Voter Verification</CardTitle>
//                             <CardDescription className="text-gray-600">
//                                 Please verify your identity to proceed to voting
//                             </CardDescription>
//                         </CardHeader>
//                         <CardContent className="space-y-6">
//                             {verification.error && (
//                                 <Alert variant="destructive">
//                                     <AlertDescription>{verification.error}</AlertDescription>
//                                 </Alert>
//                             )}
//
//                             <div className="space-y-4">
//                                 <div className="space-y-2">
//                                     <Label htmlFor="fullName">Full Name</Label>
//                                     <div className="relative">
//                                         <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                                         <Input
//                                             id="fullName"
//                                             type="text"
//                                             placeholder="Your Full Name"
//                                             value={verification.name}
//                                             onChange={(e) => setVerification(prev => ({ ...prev, name: e.target.value }))}
//                                             className="pl-10"
//                                             disabled={verification.isLoading || verification.isCodeSent}
//                                         />
//                                     </div>
//                                 </div>
//
//                                 <div className="space-y-2">
//                                     <Label htmlFor="email">Email Address</Label>
//                                     <div className="relative">
//                                         <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                                         <Input
//                                             id="email"
//                                             type="email"
//                                             placeholder="your.email@example.com"
//                                             value={verification.email}
//                                             onChange={(e) => setVerification(prev => ({ ...prev, email: e.target.value }))}
//                                             className="pl-10"
//                                             disabled={verification.isLoading || verification.isCodeSent}
//                                         />
//                                     </div>
//                                 </div>
//
//                                 <div className="space-y-2">
//                                     <Label htmlFor="phoneNumber">Phone Number</Label>
//                                     <div className="relative">
//                                         <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                                         <Input
//                                             id="phoneNumber"
//                                             type="tel"
//                                             placeholder="e.g., +233 24 123 4567 or 0244123456"
//                                             value={verification.phoneNumber}
//                                             onChange={(e) => setVerification(prev => ({ ...prev, phoneNumber: e.target.value }))}
//                                             className="pl-10"
//                                             disabled={verification.isLoading || verification.isCodeSent}
//                                         />
//                                     </div>
//                                 </div>
//
//                                 {!verification.isCodeSent ? (
//                                     <Button
//                                         onClick={handleSendCode}
//                                         className="w-full bg-blue-600 hover:bg-blue-700"
//                                         disabled={verification.isLoading}
//                                     >
//                                         {verification.isLoading ? "Sending..." : "Send Verification Code"}
//                                     </Button>
//                                 ) : (
//                                     <>
//                                         <div className="space-y-2">
//                                             <Label htmlFor="verificationCode">Verification Code</Label>
//                                             <div className="relative">
//                                                 <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                                                 <Input
//                                                     id="verificationCode"
//                                                     type="text"
//                                                     placeholder="Enter 6-digit code from SMS"
//                                                     value={verification.otp}
//                                                     onChange={(e) => {
//                                                         const value = e.target.value.replace(/\D/g, '').slice(0, 6);
//                                                         setVerification(prev => ({ ...prev, otp: value }));
//                                                     }}
//                                                     className="pl-10"
//                                                     disabled={verification.isLoading}
//                                                     maxLength={6}
//                                                 />
//                                             </div>
//                                         </div>
//
//                                         <div className="space-y-2">
//                                             <Button
//                                                 onClick={handleVerifyAndProceed}
//                                                 className="w-full bg-green-600 hover:bg-green-700"
//                                                 disabled={verification.isLoading || verification.otp.length !== 6}
//                                             >
//                                                 {verification.isLoading ? "Verifying..." : "Verify & Proceed to Voting"}
//                                             </Button>
//
//                                             <Button
//                                                 onClick={handleResendCode}
//                                                 variant="outline"
//                                                 className="w-full"
//                                                 disabled={verification.isLoading}
//                                             >
//                                                 Resend Code
//                                             </Button>
//                                         </div>
//                                     </>
//                                 )}
//                             </div>
//                         </CardContent>
//                     </Card>
//                 </div>
//             </div>
//         );
//     }
//
//     // Loading state
//     if (loading) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 flex items-center justify-center">
//                 <Card className="w-full max-w-md text-center shadow-lg">
//                     <CardContent className="p-8">
//                         <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
//                         <p className="text-gray-600">Loading voting interface...</p>
//                     </CardContent>
//                 </Card>
//             </div>
//         );
//     }
//
//     // Error state
//     if (error) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
//                 <Card className="w-full max-w-md text-center shadow-lg">
//                     <CardHeader>
//                         <CardTitle className="text-red-600">Error</CardTitle>
//                     </CardHeader>
//                     <CardContent className="space-y-4">
//                         <p className="text-gray-600">{error}</p>
//                         <div className="space-y-2">
//                             <Button onClick={() => window.location.reload()} className="w-full">
//                                 Try Again
//                             </Button>
//                             <Button onClick={handleLogout} variant="outline" className="w-full">
//                                 Return to Home
//                             </Button>
//                         </div>
//                     </CardContent>
//                 </Card>
//             </div>
//         );
//     }
//
//     if (hasVoted) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
//                 <Card className="w-full max-w-md text-center shadow-lg">
//                     <CardHeader className="space-y-4">
//                         <div className="flex justify-center items-center space-x-4">
//                             <Image
//                                 src="/images/imcs-pax-romana.jpeg"
//                                 alt="IMCS-Pax Romana"
//                                 width={60}
//                                 height={60}
//                                 className="rounded-full"
//                             />
//                             <Image
//                                 src="/images/knust-seal.jpg"
//                                 alt="KNUST"
//                                 width={60}
//                                 height={60}
//                                 className="rounded-full"
//                             />
//                         </div>
//                         <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
//                             <CheckCircle className="h-8 w-8 text-green-600" />
//                         </div>
//                         <CardTitle className="text-2xl font-bold text-gray-900">Vote Submitted Successfully!</CardTitle>
//                         <CardDescription className="text-gray-600">
//                             Thank you for participating in the IMCS-Pax Romana KNUST elections
//                         </CardDescription>
//                     </CardHeader>
//                     <CardContent className="space-y-4">
//                         <div className="bg-green-50 border border-green-200 rounded-lg p-4">
//                             <p className="text-green-800 text-sm">
//                                 Your vote has been securely recorded and encrypted. Results will be announced after the
//                                 voting period ends.
//                             </p>
//                         </div>
//                         <div className="space-y-2 text-sm text-gray-600">
//                             <p>
//                                 <strong>Voter:</strong> {user?.name}
//                             </p>
//                             {user?.phoneNumber && (
//                                 <p>
//                                     <strong>Phone:</strong> {user.phoneNumber}
//                                 </p>
//                             )}
//                             <p>
//                                 <strong>Time:</strong> {new Date().toLocaleString()}
//                             </p>
//                         </div>
//                         <Button onClick={handleLogout} className="w-full bg-blue-600 hover:bg-blue-700">
//                             Return to Home
//                         </Button>
//                     </CardContent>
//                 </Card>
//             </div>
//         );
//     }
//
//     // No ballot data available
//     if (!ballotData || ballotData.length === 0) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
//                 <Card className="w-full max-w-md text-center shadow-lg">
//                     <CardHeader>
//                         <CardTitle className="text-yellow-600">No Ballot Available</CardTitle>
//                     </CardHeader>
//                     <CardContent className="space-y-4">
//                         <p className="text-gray-600">There are no positions available for voting at this time.</p>
//                         <Button onClick={handleLogout} className="w-full">
//                             Return to Home
//                         </Button>
//                     </CardContent>
//                 </Card>
//             </div>
//         );
//     }
//
//     return (
//         <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50">
//             {/* Header */}
//             <header className="bg-white shadow-sm border-b border-gray-200">
//                 <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
//                     <div className="flex items-center justify-between">
//                         <div className="flex items-center space-x-4">
//                             <Image
//                                 src="/images/imcs-pax-romana.png"
//                                 alt="IMCS-Pax Romana"
//                                 width={40}
//                                 height={40}
//                                 className="rounded-full"
//                             />
//                             <Image
//                                 src="/images/knust-seal.jpg"
//                                 alt="KNUST"
//                                 width={40}
//                                 height={40}
//                                 className="rounded-full"
//                             />
//                             <div>
//                                 <h1 className="text-xl font-bold text-gray-900">IMCS-Pax Romana KNUST</h1>
//                                 <p className="text-sm text-blue-600">Liberation for Peace</p>
//                             </div>
//                         </div>
//                         <div className="flex items-center space-x-4">
//                             <div className="text-right">
//                                 <p className="text-sm font-medium text-gray-900">{user?.name}</p>
//                                 {user?.phoneNumber && (
//                                     <p className="text-xs text-gray-500">{user.phoneNumber}</p>
//                                 )}
//                             </div>
//                             <Button variant="outline" onClick={handleLogout} size="sm">
//                                 <Shield className="h-4 w-4 mr-2" />
//                                 Sign Out
//                             </Button>
//                         </div>
//                     </div>
//                 </div>
//             </header>
//
//             {/* Main Content */}
//             <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//                 {/* Progress Header */}
//                 <div className="mb-8">
//                     <div className="flex items-center justify-between mb-4">
//                         <h2 className="text-2xl font-bold text-gray-900">Cast Your Vote</h2>
//                         <div className="flex items-center space-x-2 text-sm text-gray-600">
//                             <Clock className="h-4 w-4" />
//                             <span>Time remaining: {timeRemaining}</span>
//                         </div>
//                     </div>
//                     <div className="space-y-2">
//                         <div className="flex justify-between text-sm text-gray-600">
//                             <span>
//                                 Position {currentPositionIndex + 1} of {ballotData.length}
//                             </span>
//                             <span>{Math.round(progress)}% complete</span>
//                         </div>
//                         <Progress value={progress} className="h-2" />
//                     </div>
//                 </div>
//
//                 {/* Position Card */}
//                 <div className="mb-8 bg-white rounded-lg shadow-lg overflow-hidden">
//                     <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
//                         <h3 className="text-2xl font-bold">{currentPosition.title}</h3>
//                         <div className="flex items-center space-x-2 mt-2">
//                             <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm">
//                                 Select {currentPosition.maxSelections} candidate{currentPosition.maxSelections > 1 ? "s" : ""}
//                             </span>
//                         </div>
//                     </div>
//                     <div className="p-6">
//                         <div className="flex gap-6">
//                             {currentPosition.candidates.map((candidate) => {
//                                 const isSelected = (selections[currentPosition.id] || []).includes(candidate.id);
//                                 const isUnopposed = currentPosition.candidates.length === 1;
//
//                                 return (
//                                     <div
//                                         key={candidate.id}
//                                         className={`flex-1 border-2 rounded-lg p-6 cursor-pointer transition-all duration-200 ${
//                                             isSelected
//                                                 ? "border-blue-500 bg-blue-50 shadow-md"
//                                                 : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
//                                         }`}
//                                         onClick={() => handleCandidateSelect(candidate.id)}
//                                     >
//                                         <div className="flex flex-col items-center text-center space-y-4">
//                                             <div className="relative">
//                                                 <img
//                                                     src={candidate.image || "/placeholder.svg?height=150&width=150"}
//                                                     alt={candidate.name}
//                                                     className="w-32 h-32 rounded-lg object-cover shadow-md"
//                                                 />
//                                                 {isSelected && (
//                                                     <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
//                                                         <CheckCircle className="h-5 w-5 text-white" />
//                                                     </div>
//                                                 )}
//                                             </div>
//                                             <div className="flex-1">
//                                                 <div className="flex flex-col items-center space-y-2">
//                                                     <h4 className="text-xl font-semibold text-gray-900">{candidate.name}</h4>
//                                                     {isUnopposed && (
//                                                         <span className="text-green-600 border border-green-600 px-3 py-1 rounded-full text-sm">
//                                                             Unopposed
//                                                         </span>
//                                                     )}
//                                                 </div>
//                                             </div>
//                                         </div>
//                                     </div>
//                                 );
//                             })}
//                         </div>
//
//                         {currentPosition.candidates.length === 0 && (
//                             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
//                                 <p className="text-yellow-800">No candidates have been nominated for this position yet.</p>
//                             </div>
//                         )}
//                     </div>
//                 </div>
//
//                 {/* Navigation */}
//                 <div className="flex items-center justify-between">
//                     <Button
//                         variant="outline"
//                         onClick={handlePrevious}
//                         disabled={currentPositionIndex === 0}
//                         className="flex items-center space-x-2 bg-transparent"
//                     >
//                         <ArrowLeft className="h-4 w-4" />
//                         <span>Previous</span>
//                     </Button>
//
//                     <div className="flex items-center space-x-4">
//                         {!isPositionComplete() && currentPosition.candidates.length > 0 && (
//                             <Alert className="border-yellow-200 bg-yellow-50">
//                                 <AlertDescription className="text-yellow-800">
//                                     Please select a candidate to continue
//                                 </AlertDescription>
//                             </Alert>
//                         )}
//                     </div>
//
//                     {currentPositionIndex < ballotData.length - 1 ? (
//                         <Button
//                             onClick={handleNext}
//                             disabled={!isPositionComplete() && currentPosition.candidates.length > 0}
//                             className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
//                         >
//                             <span>Next</span>
//                             <ArrowRight className="h-4 w-4" />
//                         </Button>
//                     ) : (
//                         <Button
//                             onClick={handleSubmitVote}
//                             disabled={!allPositionsComplete() || isSubmitting}
//                             className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
//                         >
//                             {isSubmitting ? (
//                                 <>
//                                     <Loader2 className="h-4 w-4 animate-spin" />
//                                     <span>Submitting...</span>
//                                 </>
//                             ) : (
//                                 <>
//                                     <Vote className="h-4 w-4" />
//                                     <span>Submit Vote</span>
//                                 </>
//                             )}
//                         </Button>
//                     )}
//                 </div>
//
//                 {/* Summary */}
//                 {currentPositionIndex === ballotData.length - 1 && (
//                     <Card className="mt-8 border-green-200">
//                         <CardHeader>
//                             <CardTitle className="text-green-800">Vote Summary</CardTitle>
//                             <CardDescription>Review your selections before submitting</CardDescription>
//                         </CardHeader>
//                         <CardContent>
//                             <div className="space-y-4">
//                                 {ballotData.map((position) => {
//                                     const positionSelections = selections[position.id] || [];
//                                     const selectedCandidates = position.candidates.filter((c) => positionSelections.includes(c.id));
//
//                                     return (
//                                         <div
//                                             key={position.id}
//                                             className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
//                                         >
//                                             <span className="font-medium text-gray-900">{position.title}:</span>
//                                             <span className="text-gray-600">
//                                                 {selectedCandidates.length > 0
//                                                     ? selectedCandidates.map((c) => c.name).join(", ")
//                                                     : "No selection"}
//                                             </span>
//                                         </div>
//                                     );
//                                 })}
//                             </div>
//                         </CardContent>
//                     </Card>
//                 )}
//
//                 {/* Error Display */}
//                 {error && (
//                     <Alert className="mt-4 border-red-200 bg-red-50">
//                         <AlertDescription className="text-red-800">
//                             {error}
//                         </AlertDescription>
//                     </Alert>
//                 )}
//             </main>
//         </div>
//     );
// }