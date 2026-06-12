"use client"

import { VotingInterface } from "@/components/voting-interface"
import { type Position } from "@/lib/api-config"

// Updated positions to match the API structure
const positions: Position[] = [
  {
    id: "president",
    title: "President",
    maxSelections: 1,
    candidates: [
      {
        id: "1",
        name: "Candidate A",
        position: "President",
        image: "/placeholder.svg?height=150&width=150"
      },
      {
        id: "2",
        name: "Candidate B",
        position: "President",
        image: "/placeholder.svg?height=150&width=150"
      },
      {
        id: "3",
        name: "Candidate C",
        position: "President",
        image: "/placeholder.svg?height=150&width=150"
      },
    ],
  },
  {
    id: "vice-president",
    title: "Vice President",
    maxSelections: 1,
    candidates: [
      {
        id: "4",
        name: "John Doe",
        position: "Vice President",
        image: "/placeholder.svg?height=150&width=150"
      },
      {
        id: "5",
        name: "Jane Smith",
        position: "Vice President",
        image: "/placeholder.svg?height=150&width=150"
      },
    ],
  },
  {
    id: "gen-secretary",
    title: "General Secretary",
    maxSelections: 1,
    candidates: [
      {
        id: "6",
        name: "Michael Johnson",
        position: "General Secretary",
        image: "/placeholder.svg?height=150&width=150"
      }
    ],
  },
  {
    id: "financial-secretary",
    title: "Financial Secretary",
    maxSelections: 1,
    candidates: [
      {
        id: "7",
        name: "Sarah Wilson",
        position: "Financial Secretary",
        image: "/placeholder.svg?height=150&width=150"
      },
      {
        id: "8",
        name: "David Brown",
        position: "Financial Secretary",
        image: "/placeholder.svg?height=150&width=150"
      },
    ],
  },
  {
    id: "organizing-secretary-main",
    title: "Organizing Secretary (Main)",
    maxSelections: 1,
    candidates: [
      {
        id: "9",
        name: "Emily Davis",
        position: "Organizing Secretary (Main)",
        image: "/placeholder.svg?height=150&width=150"
      },
      {
        id: "10",
        name: "Robert Miller",
        position: "Organizing Secretary (Main)",
        image: "/placeholder.svg?height=150&width=150"
      },
    ],
  },
  {
    id: "organizing-secretary-assistant",
    title: "Organizing Secretary (Assistant)",
    maxSelections: 1,
    candidates: [
      {
        id: "11",
        name: "Lisa Anderson",
        position: "Organizing Secretary (Assistant)",
        image: "/placeholder.svg?height=150&width=150"
      }
    ],
  },
  {
    id: "pro-main",
    title: "PRO (Main)",
    maxSelections: 1,
    candidates: [
      {
        id: "12",
        name: "James Taylor",
        position: "PRO (Main)",
        image: "/placeholder.svg?height=150&width=150"
      },
      {
        id: "13",
        name: "Maria Garcia",
        position: "PRO (Main)",
        image: "/placeholder.svg?height=150&width=150"
      },
    ],
  },
  {
    id: "pro-assistant",
    title: "PRO (Assistant)",
    maxSelections: 1,
    candidates: [
      {
        id: "14",
        name: "Kevin White",
        position: "PRO (Assistant)",
        image: "/placeholder.svg?height=150&width=150"
      },
      {
        id: "15",
        name: "Amanda Lee",
        position: "PRO (Assistant)",
        image: "/placeholder.svg?height=150&width=150"
      },
    ],
  },
  {
    id: "women-commissioner",
    title: "Women Commissioner",
    maxSelections: 1,
    candidates: [
      {
        id: "16",
        name: "Rachel Green",
        position: "Women Commissioner",
        image: "/placeholder.svg?height=150&width=150"
      },
      {
        id: "17",
        name: "Monica Blue",
        position: "Women Commissioner",
        image: "/placeholder.svg?height=150&width=150"
      },
    ],
  },
]

export default function VotingPage() {
  // Simply render the VotingInterface component with the position data
  // The VotingInterface handles its own authentication via SMS verification
  return <VotingInterface positions={positions} />
}