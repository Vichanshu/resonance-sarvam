import "temporal-polyfill/full/global"
import { Temporal } from "temporal-polyfill"

import { auth, currentUser } from "@clerk/nextjs/server"
import { and } from "@prisma/orm-postgres/orm-client"

import { db } from "@/prisma/db"
import {
    MAX_FREE_AGENTS,
    MAX_FREE_MEETINGS,
    MEETING_STATUSES,
    PAGE_SIZE,
    type MeetingStatus,
    type PlanName,
} from "./constants"
import { githubRepoFromText, loadProjectContext } from "./github"
import type { AgentItem, ChatItem, MeetingDetail, MeetingItem, TurnItem, Usage } from "./types"

export class MeetError extends Error {}

export async function requireOrg() {
    const { userId, orgId } = await auth()
    if (!userId || !orgId) {
        throw new MeetError("Sign in and choose a workspace to continue.")
    }
    const user = await currentUser()
    return {
        userId,
        orgId,
        name: user?.fullName || user?.firstName || "You",
    }
}

function iso(value: unknown) {
    if (value == null) return null
    if (value instanceof Date) return value.toISOString()
    if (typeof value === "object" && "epochMilliseconds" in value) {
        return new Date(Number((value as { epochMilliseconds: number }).epochMilliseconds)).toISOString()
    }
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function secondsBetween(start: string | null, end: string | null) {
    if (!start || !end) return null
    return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
}

async function countAgents(orgId: string) {
    const result = await db.orm.public.Agent.where({ orgId }).aggregate((aggregate) => ({
        total: aggregate.count(),
    }))
    return result.total
}

async function countMeetings(orgId: string) {
    const result = await db.orm.public.Meeting.where({ orgId }).aggregate((aggregate) => ({
        total: aggregate.count(),
    }))
    return result.total
}

export async function getUsage(): Promise<Usage> {
    const { orgId } = await requireOrg()
    const existing = await db.orm.public.OrgPlan.where({ orgId }).first()
    const plan = (existing?.plan ?? "FREE") as PlanName
    const [agentCount, meetingCount] = await Promise.all([
        countAgents(orgId),
        countMeetings(orgId),
    ])
    return { plan, agentCount, meetingCount }
}

async function assertCanCreate(kind: "agents" | "meetings") {
    const usage = await getUsage()
    if (usage.plan === "PRO") return usage
    if (kind === "agents" && usage.agentCount >= MAX_FREE_AGENTS) {
        throw new MeetError("You have reached the maximum number of free agents.")
    }
    if (kind === "meetings" && usage.meetingCount >= MAX_FREE_MEETINGS) {
        throw new MeetError("You have reached the maximum number of free meetings.")
    }
    return usage
}

function agentItem(
    row: {
        id: string
        name: string
        instructions: string
        language: string
        speaker: string
        createdAt: unknown
    },
    meetingCount: number,
): AgentItem {
    return {
        id: row.id,
        name: row.name,
        instructions: row.instructions,
        language: row.language,
        speaker: row.speaker,
        meetingCount,
        createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    }
}

export async function listAgents(input: { search?: string; page: number }) {
    const { orgId } = await requireOrg()
    const search = input.search?.trim() ?? ""
    const page = Math.max(1, input.page)
    const where = (agent: {
        orgId: { eq: (value: string) => unknown }
        name: { ilike: (value: string) => unknown }
    }) => {
        const org = agent.orgId.eq(orgId)
        return search ? and(org as never, agent.name.ilike(`%${search}%`) as never) : org
    }

    const [rows, totals] = await Promise.all([
        db.orm.public.Agent
            .where(where as never)
            .orderBy((agent) => agent.createdAt.desc())
            .limit(PAGE_SIZE)
            .offset((page - 1) * PAGE_SIZE)
            .all(),
        db.orm.public.Agent.where(where as never).aggregate((aggregate) => ({
            total: aggregate.count(),
        })),
    ])

    const ids = rows.map((row) => row.id)
    const meetings = ids.length
        ? await db.orm.public.Meeting.where((meeting) => meeting.agentId.in(ids)).select("id", "agentId").all()
        : []
    const counts = new Map<string, number>()
    for (const meeting of meetings) {
        counts.set(meeting.agentId, (counts.get(meeting.agentId) ?? 0) + 1)
    }

    return {
        items: rows.map((row) => agentItem(row, counts.get(row.id) ?? 0)),
        total: totals.total,
        totalPages: Math.max(1, Math.ceil(totals.total / PAGE_SIZE)),
    }
}

export async function getAgent(id: string) {
    const { orgId } = await requireOrg()
    const row = await db.orm.public.Agent.where({ id, orgId }).first()
    if (!row) return null
    const meetings = await db.orm.public.Meeting.where({ agentId: id, orgId }).all()
    return {
        agent: agentItem(row, meetings.length),
        meetings: meetings
            .map((meeting) => toMeetingItem(meeting, row.name))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }
}

export async function createAgent(input: {
    name: string
    instructions: string
    language: string
    speaker: string
}) {
    const { orgId, userId } = await requireOrg()
    await assertCanCreate("agents")
    return db.orm.public.Agent.create({
        orgId,
        userId,
        name: input.name,
        instructions: input.instructions,
        language: input.language,
        speaker: input.speaker,
    })
}

export async function updateAgent(input: {
    id: string
    name: string
    instructions: string
    language: string
    speaker: string
}) {
    const { orgId } = await requireOrg()
    const updated = await db.orm.public.Agent.where({ id: input.id, orgId }).update({
        name: input.name,
        instructions: input.instructions,
        language: input.language,
        speaker: input.speaker,
    })
    if (!updated) throw new MeetError("Agent not found.")
    return updated
}

export async function removeAgent(id: string) {
    const { orgId } = await requireOrg()
    const removed = await db.orm.public.Agent.where({ id, orgId }).delete()
    if (!removed) throw new MeetError("Agent not found.")
}

function toMeetingItem(
    row: {
        id: string
        name: string
        status: string
        agentId: string
        summary: string | null
        githubUrl: string | null
        resumeText: string | null
        jobDetails: string | null
        interviewStyle: string | null
        candidateName: string | null
        candidateDetails: string | null
        durationMinutes: number | null
        startedAt: unknown
        endedAt: unknown
        createdAt: unknown
    },
    agentName: string,
): MeetingItem {
    const startedAt = iso(row.startedAt)
    const endedAt = iso(row.endedAt)
    return {
        id: row.id,
        name: row.name,
        status: row.status as MeetingStatus,
        agentId: row.agentId,
        agentName,
        summary: row.summary,
        githubUrl: row.githubUrl,
        resumeText: row.resumeText,
        jobDetails: row.jobDetails,
        interviewStyle: row.interviewStyle,
        candidateName: row.candidateName,
        candidateDetails: row.candidateDetails,
        durationMinutes: row.durationMinutes,
        startedAt,
        endedAt,
        createdAt: iso(row.createdAt) ?? new Date().toISOString(),
        durationSeconds: secondsBetween(startedAt, endedAt),
    }
}

export async function listMeetings(input: {
    search?: string
    status?: string
    agentId?: string
    page: number
}) {
    const { orgId } = await requireOrg()
    const search = input.search?.trim() ?? ""
    const status = MEETING_STATUSES.find((value) => value === input.status)
    const agentId = input.agentId?.trim() || undefined
    const page = Math.max(1, input.page)

    const meetings = db.orm.public.Meeting.where((meeting) => {
        const scoped = meeting.orgId.eq(orgId)
        const withStatus = status ? and(scoped, meeting.status.eq(status)) : scoped
        const withAgent = agentId ? and(withStatus, meeting.agentId.eq(agentId)) : withStatus
        return search ? and(withAgent, meeting.name.ilike(`%${search}%`)) : withAgent
    })

    const [rows, totals] = await Promise.all([
        meetings
            .include("agent")
            .orderBy((meeting) => meeting.createdAt.desc())
            .limit(PAGE_SIZE)
            .offset((page - 1) * PAGE_SIZE)
            .all(),
        meetings.aggregate((aggregate) => ({
            total: aggregate.count(),
        })),
    ])

    return {
        items: rows.map((row) => toMeetingItem(row, row.agent.name)),
        total: totals.total,
        totalPages: Math.max(1, Math.ceil(totals.total / PAGE_SIZE)),
    }
}

async function meetingOrThrow(id: string, orgId: string) {
    const meeting = await db.orm.public.Meeting.where({ id, orgId }).include("agent").first()
    if (!meeting) throw new MeetError("Meeting not found.")
    return meeting
}

export async function getMeeting(id: string): Promise<MeetingDetail | null> {
    const { orgId } = await requireOrg()
    const meeting = await db.orm.public.Meeting.where({ id, orgId }).include("agent").first()
    if (!meeting) return null
    const [turns, messages] = await Promise.all([
        db.orm.public.TranscriptTurn.where({ meetingId: id }).orderBy((turn) => turn.createdAt.asc()).all(),
        db.orm.public.MeetingMessage.where({ meetingId: id }).orderBy((message) => message.createdAt.asc()).all(),
    ])
    return {
        ...toMeetingItem(meeting, meeting.agent.name),
        instructions: meeting.agent.instructions,
        language: meeting.agent.language,
        speaker: meeting.agent.speaker,
        projectContext: meeting.projectContext ?? null,
        turns: turns.map(toTurn),
        messages: messages.map(toChat),
    }
}

function toTurn(row: {
    id: string
    role: string
    speakerName: string
    text: string
    createdAt: unknown
}): TurnItem {
    return {
        id: row.id,
        role: row.role as TurnItem["role"],
        speakerName: row.speakerName,
        text: row.text,
        createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    }
}

function toChat(row: {
    id: string
    role: string
    text: string
    createdAt: unknown
}): ChatItem {
    return {
        id: row.id,
        role: row.role as ChatItem["role"],
        text: row.text,
        createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    }
}

export async function createMeeting(input: {
    name: string
    agentId: string
    githubUrl?: string
    resumeText?: string
    jobDetails?: string
    interviewStyle?: string
    candidateName?: string
    candidateDetails?: string
    durationMinutes?: number | null
}) {
    const { orgId, userId } = await requireOrg()
    await assertCanCreate("meetings")
    const agent = await db.orm.public.Agent.where({ id: input.agentId, orgId }).first()
    if (!agent) throw new MeetError("Agent not found.")
    const githubUrl = input.githubUrl?.trim() || null
    const resumeText = input.resumeText?.trim() || null
    const projectContext = githubUrl ? await loadProjectContext(githubUrl) : null
    return db.orm.public.Meeting.create({
        orgId,
        userId,
        name: input.name,
        agentId: agent.id,
        status: "UPCOMING",
        githubUrl,
        resumeText,
        projectContext,
        jobDetails: input.jobDetails?.trim() || null,
        interviewStyle: input.interviewStyle?.trim() || null,
        candidateName: input.candidateName?.trim() || null,
        candidateDetails: input.candidateDetails?.trim() || null,
        durationMinutes: input.durationMinutes ?? null,
    })
}

export async function updateMeeting(input: {
    id: string
    name: string
    agentId: string
    githubUrl?: string
    resumeText?: string
    jobDetails?: string
    interviewStyle?: string
    candidateName?: string
    candidateDetails?: string
    durationMinutes?: number | null
}) {
    const { orgId } = await requireOrg()
    const existing = await meetingOrThrow(input.id, orgId)
    if (existing.status !== "UPCOMING") {
        throw new MeetError("Only upcoming meetings can be edited.")
    }
    const agent = await db.orm.public.Agent.where({ id: input.agentId, orgId }).first()
    if (!agent) throw new MeetError("Agent not found.")
    const changes: {
        name: string
        agentId: string
        githubUrl?: string | null
        resumeText?: string | null
        projectContext?: string | null
        jobDetails?: string | null
        interviewStyle?: string | null
        candidateName?: string | null
        candidateDetails?: string | null
        durationMinutes?: number | null
    } = {
        name: input.name,
        agentId: agent.id,
    }
    if (input.githubUrl !== undefined) {
        const githubUrl = input.githubUrl.trim()
        changes.githubUrl = githubUrl || null
        changes.projectContext = githubUrl ? await loadProjectContext(githubUrl) : null
    }
    if (input.resumeText !== undefined) {
        changes.resumeText = input.resumeText.trim() || null
    }
    if (input.jobDetails !== undefined) changes.jobDetails = input.jobDetails.trim() || null
    if (input.interviewStyle !== undefined) changes.interviewStyle = input.interviewStyle.trim() || null
    if (input.candidateName !== undefined) changes.candidateName = input.candidateName.trim() || null
    if (input.candidateDetails !== undefined) changes.candidateDetails = input.candidateDetails.trim() || null
    if (input.durationMinutes !== undefined) changes.durationMinutes = input.durationMinutes
    await db.orm.public.Meeting.where({ id: input.id, orgId }).update(changes)
}

export async function getSharedMeeting(id: string) {
    const meeting = await db.orm.public.Meeting.where({ id }).include("agent").first()
    if (!meeting) return null
    return {
        id: meeting.id,
        name: meeting.name,
        status: meeting.status,
        agentName: meeting.agent.name,
        candidateName: meeting.candidateName,
        jobDetails: meeting.jobDetails,
        durationMinutes: meeting.durationMinutes,
        startedAt: iso(meeting.startedAt),
    }
}

export async function noteCandidateReply(meetingId: string, text: string) {
    const meeting = await db.orm.public.Meeting.where({ id: meetingId }).include("agent").first()
    if (!meeting) throw new MeetError("Meeting not found.")
    return applyCandidateReply(meeting, text)
}

export async function rememberCandidateInput(meetingId: string, text: string) {
    const { orgId } = await requireOrg()
    const meeting = await meetingOrThrow(meetingId, orgId)
    return applyCandidateReply(meeting, text)
}

export async function endSharedInterview(meetingId: string) {
    const meeting = await db.orm.public.Meeting.where({ id: meetingId }).first()
    if (!meeting) throw new MeetError("Meeting not found.")
    if (meeting.status === "COMPLETED") return
    if (meeting.status !== "ACTIVE" && meeting.status !== "PROCESSING" && meeting.status !== "UPCOMING") {
        throw new MeetError("This interview can no longer be ended.")
    }
    if (meeting.status !== "PROCESSING") {
        await db.orm.public.Meeting.where({ id: meetingId }).update({
            status: "PROCESSING",
            endedAt: Temporal.Now.instant(),
        })
    }
    const turns = await db.orm.public.TranscriptTurn
        .where({ meetingId })
        .orderBy((turn) => turn.createdAt.asc())
        .all()
    const { summarizeTranscript } = await import("./sarvam")
    const summary = await summarizeTranscript(
        turns.map((turn) => ({ speaker: turn.speakerName, text: turn.text })),
        [
            meeting.jobDetails ? `Job: ${meeting.jobDetails}` : "",
            meeting.candidateName ? `Candidate: ${meeting.candidateName}` : "",
        ].filter(Boolean).join("\n"),
    )
    await db.orm.public.Meeting.where({ id: meetingId }).update({
        status: "COMPLETED",
        summary,
        endedAt: meeting.endedAt ?? Temporal.Now.instant(),
    })
}

async function applyCandidateReply(
    meeting: {
        id: string
        orgId: string
        githubUrl: string | null
        resumeText: string | null
        projectContext: string | null
        candidateDetails: string | null
    },
    text: string,
) {
    const changes: {
        githubUrl?: string
        resumeText?: string
        projectContext?: string
        candidateDetails?: string
    } = {}
    const repo = githubRepoFromText(text)
    if (repo && repo.url !== meeting.githubUrl) {
        changes.githubUrl = repo.url
        changes.projectContext = await loadProjectContext(repo.url)
    }
    const trimmed = text.trim()
    if (trimmed.length > 500) {
        changes.resumeText = trimmed.slice(0, 12000)
    } else if (trimmed.length > 80 && !meeting.candidateDetails) {
        changes.candidateDetails = trimmed.slice(0, 4000)
    }
    if (Object.keys(changes).length > 0) {
        await db.orm.public.Meeting.where({ id: meeting.id, orgId: meeting.orgId }).update(changes)
    }
    return {
        githubUrl: changes.githubUrl ?? meeting.githubUrl ?? null,
        resumeText: changes.resumeText ?? meeting.resumeText ?? null,
        projectContext: changes.projectContext ?? meeting.projectContext ?? null,
        candidateDetails: changes.candidateDetails ?? meeting.candidateDetails ?? null,
    }
}

export async function removeMeeting(id: string) {
    const { orgId } = await requireOrg()
    const removed = await db.orm.public.Meeting.where({ id, orgId }).delete()
    if (!removed) throw new MeetError("Meeting not found.")
}

export async function cancelMeeting(id: string) {
    const { orgId } = await requireOrg()
    const existing = await meetingOrThrow(id, orgId)
    if (existing.status !== "UPCOMING") {
        throw new MeetError("Only upcoming meetings can be cancelled.")
    }
    await db.orm.public.Meeting.where({ id, orgId }).update({ status: "CANCELLED" })
}

export async function startMeeting(id: string) {
    const { orgId } = await requireOrg()
    const existing = await meetingOrThrow(id, orgId)
    if (existing.status !== "UPCOMING" && existing.status !== "ACTIVE") {
        throw new MeetError("This meeting can no longer be joined.")
    }
    if (existing.status === "UPCOMING") {
        await db.orm.public.Meeting.where({ id, orgId }).update({
            status: "ACTIVE",
            startedAt: Temporal.Now.instant(),
        })
    }
    return {
        id: existing.id,
        name: existing.name,
        agentName: existing.agent.name,
        language: existing.agent.language,
        speaker: existing.agent.speaker,
    }
}

export async function addTurn(input: {
    meetingId: string
    role: "USER" | "AGENT"
    speakerName: string
    text: string
}) {
    const { orgId } = await requireOrg()
    await meetingOrThrow(input.meetingId, orgId)
    return db.orm.public.TranscriptTurn.create({
        meetingId: input.meetingId,
        role: input.role,
        speakerName: input.speakerName,
        text: input.text,
    })
}

export async function listTurns(meetingId: string) {
    const { orgId } = await requireOrg()
    await meetingOrThrow(meetingId, orgId)
    const turns = await db.orm.public.TranscriptTurn
        .where({ meetingId })
        .orderBy((turn) => turn.createdAt.asc())
        .all()
    return turns.map(toTurn)
}

export async function finishMeeting(id: string, summary: string) {
    const { orgId } = await requireOrg()
    await meetingOrThrow(id, orgId)
    await db.orm.public.Meeting.where({ id, orgId }).update({
        status: "COMPLETED",
        summary,
        endedAt: Temporal.Now.instant(),
    })
}

export async function markProcessing(id: string) {
    const { orgId } = await requireOrg()
    const existing = await meetingOrThrow(id, orgId)
    if (existing.status !== "ACTIVE" && existing.status !== "PROCESSING") {
        throw new MeetError("This meeting is not in progress.")
    }
    if (existing.status === "ACTIVE") {
        await db.orm.public.Meeting.where({ id, orgId }).update({
            status: "PROCESSING",
            endedAt: Temporal.Now.instant(),
        })
    }
    return existing
}

export async function addChat(input: {
    meetingId: string
    role: "USER" | "AGENT"
    text: string
}) {
    const { orgId } = await requireOrg()
    await meetingOrThrow(input.meetingId, orgId)
    const created = await db.orm.public.MeetingMessage.create({
        meetingId: input.meetingId,
        role: input.role,
        text: input.text,
    })
    return toChat(created)
}

export async function setPlan(plan: PlanName) {
    const { orgId } = await requireOrg()
    const existing = await db.orm.public.OrgPlan.where({ orgId }).first()
    if (!existing) {
        await db.orm.public.OrgPlan.create({ orgId, plan })
        return
    }
    await db.orm.public.OrgPlan.where({ orgId }).update({ plan })
}

export async function listAgentOptions() {
    const { orgId } = await requireOrg()
    const rows = await db.orm.public.Agent
        .where({ orgId })
        .orderBy((agent) => agent.name.asc())
        .select("id", "name")
        .all()
    return rows.map((row) => ({ id: row.id, name: row.name }))
}
