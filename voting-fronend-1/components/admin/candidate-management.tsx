"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import {
    Plus,
    Edit,
    Trash2,
    Download,
    Printer,
    User,
    CheckCircle,
    X
} from "lucide-react"
import {candidatesApi} from "@/lib/api-config";

// Mock API configuration with localStorage persistence
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

const handleApiError = (error: any): string => {
    return error?.message || "An unexpected error occurred"
}

interface Candidate {
    id: string
    name: string
    position: CandidatePosition
    candidateNumber: number
    photoUrl?: string
    bio?: string
    manifesto?: string
}

interface CandidateFormData {
    name: string
    position: CandidatePosition | ""
    candidateNumber: string
    photo: File | null
    photoPreview: string
    bio?: string
    manifesto?: string
}

// Local storage utilities
const STORAGE_KEY = 'imcs-candidates'

const saveCandidatesToStorage = (candidates: Candidate[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates))
    } catch (error) {
        console.error('Failed to save candidates to localStorage:', error)
    }
}

const loadCandidatesFromStorage = (): Candidate[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            return JSON.parse(stored)
        }
    } catch (error) {
        console.error('Failed to load candidates from localStorage:', error)
    }

    // Return initial mock data if nothing in storage
    return [
        {
            id: "1",
            name: "John Doe",
            position: "PRESIDENT",
            candidateNumber: 1,
            photoUrl: "",
            bio: "Experienced leader with vision for change"
        },
        {
            id: "2",
            name: "Jane Smith",
            position: "PRESIDENT",
            candidateNumber: 2,
            photoUrl: "",
            bio: "Dedicated public servant"
        }
    ]
}

export default function CandidateManagement() {
    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null)
    const [formData, setFormData] = useState<CandidateFormData>({
        name: "",
        position: "",
        candidateNumber: "",
        photo: null,
        photoPreview: "",
        bio: "",
        manifesto: ""
    })
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        loadCandidates()
    }, [])

    const loadCandidates = async () => {
        try {
            setLoading(true)

            // Try to load from API first, fallback to localStorage
            try {
                // Uncomment this when your API is ready
                const candidatesList = await candidatesApi.getAllForAdmin()
                //@ts-ignore
                setCandidates(candidatesList)
                //@ts-ignore
                saveCandidatesToStorage(candidatesList)

                // For now, load from localStorage
                // const candidatesList = loadCandidatesFromStorage()
                // setCandidates(candidatesList)

                toast.success("Candidates loaded successfully", {
                    description: `Loaded ${candidatesList.length} candidates from local storage`
                })
            } catch (apiError) {
                console.warn('API failed, using localStorage:', apiError)
                const candidatesList = loadCandidatesFromStorage()
                setCandidates(candidatesList)

                toast.info("Using local data", {
                    description: "API unavailable, loaded candidates from local storage"
                })
            }
        } catch (error: any) {
            console.error('Error loading candidates:', error)
            toast.error("Failed to load candidates", {
                description: handleApiError(error)
            })
        } finally {
            setLoading(false)
        }
    }

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {}

        // Validate name
        if (!formData.name.trim()) {
            errors.name = "Candidate name is required"
        } else if (formData.name.trim().length < 2) {
            errors.name = "Name must be at least 2 characters long"
        }

        // Validate position
        if (!formData.position) {
            errors.position = "Position is required"
        }

        // Validate candidate number
        if (!formData.candidateNumber.trim()) {
            errors.candidateNumber = "Candidate number is required"
        } else {
            const candidateNum = parseInt(formData.candidateNumber)

            if (isNaN(candidateNum)) {
                errors.candidateNumber = "Candidate number must be a valid number"
            } else if (candidateNum < 1) {
                errors.candidateNumber = "Candidate number must be greater than 0"
            } else if (candidateNum > 999) {
                errors.candidateNumber = "Candidate number must be less than 1000"
            } else {
                const isDuplicate = candidates.some(candidate =>
                    candidate.candidateNumber === candidateNum &&
                    candidate.position === formData.position &&
                    candidate.id !== editingCandidate?.id
                )

                if (isDuplicate) {
                    errors.candidateNumber = `Candidate number ${candidateNum} is already taken for this position`
                }
            }
        }

        // Validate photo upload
        if (!formData.photo && !editingCandidate) {
            errors.photo = "Photo is required"
        } else if (formData.photo) {
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
            if (!allowedTypes.includes(formData.photo.type)) {
                errors.photo = "Photo must be a JPEG, PNG, or GIF image"
            }

            const maxSize = 5 * 1024 * 1024
            if (formData.photo.size > maxSize) {
                errors.photo = "Photo must be smaller than 5MB"
            }
        }

        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    const resetForm = () => {
        setFormData({
            name: "",
            position: "",
            candidateNumber: "",
            photo: null,
            photoPreview: "",
            bio: "",
            manifesto: ""
        })
        setFormErrors({})
        setShowAddForm(false)
        setEditingCandidate(null)
    }

    const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
            setFormErrors(prev => ({ ...prev, photo: "Photo must be a JPEG, PNG, or GIF image" }))
            toast.error("Invalid file type", {
                description: "Please upload a JPEG, PNG, or GIF image"
            })
            return
        }

        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            setFormErrors(prev => ({ ...prev, photo: "Photo must be smaller than 5MB" }))
            toast.error("File too large", {
                description: "Photo must be smaller than 5MB"
            })
            return
        }

        setFormErrors(prev => {
            const newErrors = { ...prev }
            delete newErrors.photo
            return newErrors
        })

        const previewUrl = URL.createObjectURL(file)

        setFormData(prev => ({
            ...prev,
            photo: file,
            photoPreview: previewUrl
        }))

        toast.success("Photo uploaded successfully", {
            description: "Photo preview is now available"
        })
    }

    const removePhoto = () => {
        if (formData.photoPreview) {
            URL.revokeObjectURL(formData.photoPreview)
        }
        setFormData(prev => ({
            ...prev,
            photo: null,
            photoPreview: ""
        }))
        toast.info("Photo removed", {
            description: "You can upload a new photo if needed"
        })
    }

    const handleSubmit = async () => {
        if (!validateForm()) {
            toast.error("Please fix the form errors", {
                description: "Check the highlighted fields and try again"
            })
            return
        }

        try {
            setLoading(true)

            let photoUrl = editingCandidate?.photoUrl || ""

            if (formData.photo) {
                // In a real implementation, upload to your file storage service
                // For demo, we'll use the preview URL
                photoUrl = formData.photoPreview
            }

            const candidateData = {
                name: formData.name,
                position: formData.position as CandidatePosition,
                candidateNumber: parseInt(formData.candidateNumber),
                photoUrl,
                bio: formData.bio,
                manifesto: formData.manifesto
            }

            let updatedCandidates: Candidate[]

            if (editingCandidate) {
                // Update existing candidate
                updatedCandidates = candidates.map(candidate =>
                    candidate.id === editingCandidate.id
                        ? { ...candidateData, id: editingCandidate.id }
                        : candidate
                )

                toast.success("Candidate updated successfully", {
                    description: `${candidateData.name} has been updated`
                })
            } else {
                // Add new candidate
                const newCandidate: Candidate = {
                    ...candidateData,
                    id: Date.now().toString()
                }
                updatedCandidates = [...candidates, newCandidate]

                toast.success("Candidate added successfully", {
                    description: `${candidateData.name} has been added to the candidates list`
                })
            }

            // Update state and persist to localStorage
            setCandidates(updatedCandidates)
            saveCandidatesToStorage(updatedCandidates)

            resetForm()
        } catch (error: any) {
            console.error('Error saving candidate:', error)
            toast.error("Failed to save candidate", {
                description: handleApiError(error)
            })
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (candidate: Candidate) => {
        setEditingCandidate(candidate)
        setFormData({
            name: candidate.name,
            position: candidate.position,
            candidateNumber: candidate.candidateNumber.toString(),
            photo: null,
            photoPreview: candidate.photoUrl || "",
            bio: candidate.bio || "",
            manifesto: candidate.manifesto || ""
        })
        setShowAddForm(true)
        setFormErrors({})

        toast.info("Editing candidate", {
            description: `Now editing ${candidate.name}`
        })
    }

    const handleDelete = async (candidateId: string) => {
        const candidate = candidates.find(c => c.id === candidateId)
        if (!candidate) return

        if (!confirm("Are you sure you want to delete this candidate? This action cannot be undone.")) {
            return
        }

        try {
            setLoading(true)

            const updatedCandidates = candidates.filter(candidate => candidate.id !== candidateId)
            setCandidates(updatedCandidates)
            saveCandidatesToStorage(updatedCandidates)

            toast.success("Candidate deleted", {
                description: `${candidate.name} has been removed from the candidates list`
            })
        } catch (error: any) {
            console.error('Error deleting candidate:', error)
            toast.error("Failed to delete candidate", {
                description: handleApiError(error)
            })
        } finally {
            setLoading(false)
        }
    }

    const handleExportCSV = () => {
        const csvContent = [
            ["Name", "Position", "Candidate Number", "Bio"],
            ...candidates.map((candidate) => [
                candidate.name,
                positionDisplayNames[candidate.position],
                candidate.candidateNumber,
                candidate.bio || ""
            ]),
        ]
            .map((row) => row.join(","))
            .join("\n")

        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `candidates-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)

        toast.success("CSV exported successfully", {
            description: "Candidates list has been downloaded"
        })
    }

    const handleClearAllData = () => {
        if (!confirm("Are you sure you want to clear all candidate data? This action cannot be undone.")) {
            return
        }

        try {
            localStorage.removeItem(STORAGE_KEY)
            setCandidates([])

            toast.success("All data cleared", {
                description: "All candidates have been removed from storage"
            })
        } catch (error) {
            toast.error("Failed to clear data", {
                description: "Please try again"
            })
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Candidate Management</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleExportCSV}>
                                <Download className="h-4 w-4 mr-2" />
                                Export List
                            </Button>
                            <Button variant="outline" onClick={() => {
                                window.print()
                                toast.info("Print dialog opened", {
                                    description: "Printing candidates list"
                                })
                            }}>
                                <Printer className="h-4 w-4 mr-2" />
                                Print List
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleClearAllData}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                Clear All
                            </Button>
                            <Button
                                onClick={() => setShowAddForm(true)}
                                disabled={loading}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Candidate
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Add/Edit Form */}
            {showAddForm && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>
                                {editingCandidate ? "Edit Candidate" : "Add New Candidate"}
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={resetForm}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">Candidate Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter candidate name"
                                    className={formErrors.name ? "border-red-500" : ""}
                                />
                                {formErrors.name && (
                                    <p className="text-sm text-red-600">{formErrors.name}</p>
                                )}
                            </div>

                            {/* Position */}
                            <div className="space-y-2">
                                <Label htmlFor="position">Position *</Label>
                                <Select
                                    value={formData.position}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, position: value as CandidatePosition }))}
                                >
                                    <SelectTrigger className={formErrors.position ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select position" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(positionDisplayNames).map(([key, displayName]) => (
                                            <SelectItem key={key} value={key}>
                                                {displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {formErrors.position && (
                                    <p className="text-sm text-red-600">{formErrors.position}</p>
                                )}
                            </div>

                            {/* Candidate Number */}
                            <div className="space-y-2">
                                <Label htmlFor="candidateNumber">Candidate Number *</Label>
                                <Input
                                    id="candidateNumber"
                                    type="number"
                                    min="1"
                                    max="999"
                                    value={formData.candidateNumber}
                                    onChange={(e) => setFormData(prev => ({ ...prev, candidateNumber: e.target.value }))}
                                    placeholder="Enter candidate number (1-999)"
                                    className={formErrors.candidateNumber ? "border-red-500" : ""}
                                />
                                {formErrors.candidateNumber && (
                                    <p className="text-sm text-red-600">{formErrors.candidateNumber}</p>
                                )}
                            </div>

                            {/* Photo Upload */}
                            <div className="space-y-2">
                                <Label htmlFor="photo">Candidate Photo *</Label>
                                <div className="space-y-3">
                                    {/* Photo Preview */}
                                    {formData.photoPreview && (
                                        <div className="relative inline-block">
                                            <img
                                                src={formData.photoPreview}
                                                alt="Preview"
                                                className="w-24 h-24 rounded-lg object-cover border-2 border-gray-200"
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                                onClick={removePhoto}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}

                                    {/* File Input */}
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="photo"
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/gif"
                                            onChange={handlePhotoUpload}
                                            className={`file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${formErrors.photo ? "border-red-500" : ""}`}
                                        />
                                        {formData.photo && (
                                            <div className="flex items-center text-sm text-green-600">
                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                File selected
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-gray-500">
                                        Upload a clear photo of the candidate. Accepted formats: JPEG, PNG, GIF. Max size: 5MB.
                                    </p>

                                    {formErrors.photo && (
                                        <p className="text-sm text-red-600">{formErrors.photo}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bio */}
                        <div className="space-y-2">
                            <Label htmlFor="bio">Biography (Optional)</Label>
                            <textarea
                                id="bio"
                                value={formData.bio}
                                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                placeholder="Brief biography of the candidate"
                                className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={resetForm} disabled={loading}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading}>
                                {loading ? "Saving..." : editingCandidate ? "Update Candidate" : "Add Candidate"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Candidates List */}
            <Card>
                <CardHeader>
                    <CardTitle>Candidates List ({candidates.length} candidates)</CardTitle>
                </CardHeader>
                <CardContent>
                    {candidates.length === 0 ? (
                        <div className="text-center py-12">
                            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No candidates added yet</h3>
                            <p className="text-gray-600 mb-4">Click "Add Candidate" to get started.</p>
                            <Button onClick={() => setShowAddForm(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your First Candidate
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="text-left p-3 font-medium text-gray-900">Candidate</th>
                                    <th className="text-left p-3 font-medium text-gray-900">Position</th>
                                    <th className="text-left p-3 font-medium text-gray-900">Number</th>
                                    <th className="text-left p-3 font-medium text-gray-900">Photo</th>
                                    <th className="text-left p-3 font-medium text-gray-900">Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {candidates.map((candidate) => (
                                    <tr key={candidate.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">
                                            <div>
                                                <div className="font-medium">{candidate.name}</div>
                                                {candidate.bio && (
                                                    <div className="text-sm text-gray-600 mt-1">
                                                        {candidate.bio.length > 100
                                                            ? `${candidate.bio.substring(0, 100)}...`
                                                            : candidate.bio
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <Badge variant="outline">
                                                {positionDisplayNames[candidate.position]}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            <Badge variant="secondary">
                                                #{candidate.candidateNumber}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            {candidate.photoUrl ? (
                                                <img
                                                    src={candidate.photoUrl}
                                                    alt={candidate.name}
                                                    className="w-10 h-10 rounded-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none'
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                    <User className="h-5 w-5 text-gray-500" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEdit(candidate)}
                                                    disabled={loading}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDelete(candidate.id)}
                                                    disabled={loading}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Development Note */}
            {/*<Card className="border-blue-200 bg-blue-50">*/}
            {/*    <CardContent className="p-4">*/}
            {/*        <div className="flex items-center space-x-2 text-blue-800">*/}
            {/*            <CheckCircle className="h-4 w-4" />*/}
            {/*            <span className="text-sm font-medium">Development Mode</span>*/}
            {/*        </div>*/}
            {/*        <p className="text-sm text-blue-700 mt-1">*/}
            {/*            Data is currently stored in localStorage and will persist across page refreshes.*/}
            {/*            When your API is ready, uncomment the API calls in the loadCandidates() function.*/}
            {/*        </p>*/}
            {/*    </CardContent>*/}
            {/*</Card>*/}

            {/* Sonner Toaster */}
            <Toaster position="top-right" />
        </div>
    )
}