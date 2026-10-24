import type { MeetingStatus, PlanName, SpeakerRole } from "./constants"

export type Usage = {
    plan: PlanName
    agentCount: number
    meetingCount: number
}

export type AgentItem = {
    id: string
    name: string
    instructions: string
    language: string
    speaker: string
    meetingCount: number
    createdAt: string
}

export type MeetingItem = {
    id: string
    name: string
    status: MeetingStatus
    agentId: string
    agentName: string
    summary: string | null
    githubUrl: string | null
    resumeText: string | null
    jobDetails: string | null
    interviewStyle: string | null
    candidateName: string | null
    candidateDetails: string | null
    durationMinutes: number | null
    startedAt: string | null
    endedAt: string | null
    createdAt: string
    durationSeconds: number | null
}

export type TurnItem = {
    id: string
    role: SpeakerRole
    speakerName: string
    text: string
    createdAt: string
}

export type ChatItem = {
    id: string
    role: SpeakerRole
    text: string
    createdAt: string
}

export type MeetingDetail = MeetingItem & {
    instructions: string
    language: string
    speaker: string
    projectContext: string | null
    turns: TurnItem[]
    messages: ChatItem[]
}

export type ActionResult<T = undefined> =
    | { ok: true; data: T }
    | { ok: false; error: string }
