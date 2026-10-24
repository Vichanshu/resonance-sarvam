export const PAGE_SIZE = 8
export const MAX_FREE_AGENTS = 1
export const MAX_FREE_MEETINGS = 3

export const LANGUAGES = [
    { id: "en-IN", label: "English (India)" },
    { id: "hi-IN", label: "Hindi" },
    { id: "bn-IN", label: "Bengali" },
    { id: "ta-IN", label: "Tamil" },
    { id: "te-IN", label: "Telugu" },
    { id: "kn-IN", label: "Kannada" },
    { id: "ml-IN", label: "Malayalam" },
    { id: "mr-IN", label: "Marathi" },
    { id: "gu-IN", label: "Gujarati" },
    { id: "pa-IN", label: "Punjabi" },
    { id: "od-IN", label: "Odia" },
] as const

export const SPEAKERS = [
    { id: "shubh", label: "Shubh" },
    { id: "aditya", label: "Aditya" },
    { id: "rahul", label: "Rahul" },
    { id: "ritu", label: "Ritu" },
    { id: "priya", label: "Priya" },
    { id: "neha", label: "Neha" },
    { id: "pooja", label: "Pooja" },
    { id: "simran", label: "Simran" },
] as const

export const MEETING_STATUSES = [
    "UPCOMING",
    "ACTIVE",
    "PROCESSING",
    "COMPLETED",
    "CANCELLED",
] as const

export type MeetingStatus = (typeof MEETING_STATUSES)[number]
export type SpeakerRole = "USER" | "AGENT"
export type PlanName = "FREE" | "PRO"

export const DEFAULT_INSTRUCTIONS =
    "You are a technical interviewer. Ask about the candidate's resume and the code in their GitHub project. One question at a time. Follow up on the specific decision they just described."

export const SUMMARY_SYSTEM = `You are an expert summarizer. You write readable, concise, simple content. You are given a transcript of a meeting and you need to summarize it.

Use the following markdown structure for every output:

### Overview
Provide a detailed, engaging summary of the session's content. Focus on major topics, decisions, and any key takeaways. Write in a narrative style, using full sentences.

### Notes
Break down key content into thematic sections. Each section should summarize key points, actions, or decisions in bullet format.

#### Section name
- Main point discussed here
- Another key insight or decision
- Follow-up or owner, if one was mentioned`

export function statusLabel(status: MeetingStatus) {
    return status.charAt(0) + status.slice(1).toLowerCase()
}
