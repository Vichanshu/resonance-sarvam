"use server"

import { revalidatePath } from "next/cache"

import { LANGUAGES, SPEAKERS } from "./constants"
import {
    MeetError,
    cancelMeeting,
    createAgent,
    createMeeting,
    finishMeeting,
    getMeeting,
    listTurns,
    markProcessing,
    rememberCandidateInput,
    removeAgent,
    removeMeeting,
    setPlan,
    startMeeting,
    updateAgent,
    updateMeeting,
    addChat,
} from "./data"
import { chat, followUpInstructions, speak, summarizeTranscript } from "./sarvam"
import type { PlanName } from "./constants"
import type { ActionResult, ChatItem } from "./types"

function fail(error: unknown): ActionResult<never> {
    const message = error instanceof MeetError
        ? error.message
        : error instanceof Error
            ? error.message
            : "Something went wrong."
    return { ok: false, error: message }
}

function clean(value: FormDataEntryValue | null) {
    return typeof value === "string" ? value.trim() : ""
}

function minutesField(value: FormDataEntryValue | null) {
    const text = clean(value)
    if (!text) return null
    const minutes = Number(text)
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) return null
    return minutes
}

function languageOrDefault(value: string) {
    return LANGUAGES.some((language) => language.id === value) ? value : "en-IN"
}

function speakerOrDefault(value: string) {
    return SPEAKERS.some((speaker) => speaker.id === value) ? value : "shubh"
}

export async function createAgentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
    try {
        const name = clean(formData.get("name"))
        const instructions = clean(formData.get("instructions"))
        if (!name || !instructions) return { ok: false, error: "Name and instructions are required." }
        const agent = await createAgent({
            name,
            instructions,
            language: languageOrDefault(clean(formData.get("language"))),
            speaker: speakerOrDefault(clean(formData.get("speaker"))),
        })
        revalidatePath("/agents")
        return { ok: true, data: { id: agent.id } }
    } catch (error) {
        return fail(error)
    }
}

export async function updateAgentAction(formData: FormData): Promise<ActionResult> {
    try {
        const id = clean(formData.get("id"))
        const name = clean(formData.get("name"))
        const instructions = clean(formData.get("instructions"))
        if (!id || !name || !instructions) return { ok: false, error: "Name and instructions are required." }
        await updateAgent({
            id,
            name,
            instructions,
            language: languageOrDefault(clean(formData.get("language"))),
            speaker: speakerOrDefault(clean(formData.get("speaker"))),
        })
        revalidatePath("/agents")
        revalidatePath(`/agents/${id}`)
        return { ok: true, data: undefined }
    } catch (error) {
        return fail(error)
    }
}

export async function removeAgentAction(id: string): Promise<ActionResult> {
    try {
        await removeAgent(id)
        revalidatePath("/agents")
        revalidatePath("/meetings")
        return { ok: true, data: undefined }
    } catch (error) {
        return fail(error)
    }
}

export async function createMeetingAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
    try {
        const name = clean(formData.get("name"))
        const agentId = clean(formData.get("agentId"))
        if (!name || !agentId) return { ok: false, error: "Name and agent are required." }
        const meeting = await createMeeting({
            name,
            agentId,
            githubUrl: clean(formData.get("githubUrl")) || undefined,
            resumeText: clean(formData.get("resumeText")) || undefined,
            jobDetails: clean(formData.get("jobDetails")) || undefined,
            interviewStyle: clean(formData.get("interviewStyle")) || undefined,
            candidateName: clean(formData.get("candidateName")) || undefined,
            candidateDetails: clean(formData.get("candidateDetails")) || undefined,
            durationMinutes: minutesField(formData.get("durationMinutes")),
        })
        revalidatePath("/meetings")
        return { ok: true, data: { id: meeting.id } }
    } catch (error) {
        return fail(error)
    }
}

export async function updateMeetingAction(formData: FormData): Promise<ActionResult> {
    try {
        const id = clean(formData.get("id"))
        const name = clean(formData.get("name"))
        const agentId = clean(formData.get("agentId"))
        if (!id || !name || !agentId) return { ok: false, error: "Name and agent are required." }
        await updateMeeting({
            id,
            name,
            agentId,
            githubUrl: clean(formData.get("githubUrl")),
            resumeText: clean(formData.get("resumeText")),
            jobDetails: clean(formData.get("jobDetails")),
            interviewStyle: clean(formData.get("interviewStyle")),
            candidateName: clean(formData.get("candidateName")),
            candidateDetails: clean(formData.get("candidateDetails")),
            durationMinutes: minutesField(formData.get("durationMinutes")),
        })
        revalidatePath("/meetings")
        revalidatePath(`/meetings/${id}`)
        return { ok: true, data: undefined }
    } catch (error) {
        return fail(error)
    }
}

export async function removeMeetingAction(id: string): Promise<ActionResult> {
    try {
        await removeMeeting(id)
        revalidatePath("/meetings")
        return { ok: true, data: undefined }
    } catch (error) {
        return fail(error)
    }
}

export async function cancelMeetingAction(id: string): Promise<ActionResult> {
    try {
        await cancelMeeting(id)
        revalidatePath("/meetings")
        revalidatePath(`/meetings/${id}`)
        return { ok: true, data: undefined }
    } catch (error) {
        return fail(error)
    }
}

export async function startMeetingAction(id: string): Promise<ActionResult<{ name: string }>> {
    try {
        const meeting = await startMeeting(id)
        revalidatePath("/meetings")
        revalidatePath(`/meetings/${id}`)
        return { ok: true, data: { name: meeting.name } }
    } catch (error) {
        return fail(error)
    }
}

export async function endMeetingAction(id: string): Promise<ActionResult> {
    try {
        await markProcessing(id)
        const turns = await listTurns(id)
        const summary = await summarizeTranscript(
            turns.map((turn) => ({ speaker: turn.speakerName, text: turn.text })),
        )
        await finishMeeting(id, summary)
        revalidatePath("/meetings")
        revalidatePath(`/meetings/${id}`)
        return { ok: true, data: undefined }
    } catch (error) {
        revalidatePath(`/meetings/${id}`)
        return fail(error)
    }
}

export async function sendChatAction(meetingId: string, text: string): Promise<ActionResult<{ messages: ChatItem[] }>> {
    try {
        const trimmed = text.trim()
        if (!trimmed) return { ok: false, error: "Write a question first." }
        const remembered = await rememberCandidateInput(meetingId, trimmed)
        const meeting = await getMeeting(meetingId)
        if (!meeting) return { ok: false, error: "Meeting not found." }
        if (meeting.status !== "COMPLETED") {
            return { ok: false, error: "Ask the agent after the meeting is summarized." }
        }
        const userMessage = await addChat({ meetingId, role: "USER", text: trimmed })
        const history = [...meeting.messages, userMessage].slice(-8).map((message) => ({
            role: message.role === "AGENT" ? "assistant" as const : "user" as const,
            content: message.text,
        }))
        const reply = await chat([
            {
                role: "system",
                content: followUpInstructions({
                    name: meeting.agentName,
                    instructions: meeting.instructions,
                    summary: meeting.summary,
                    resume: meeting.resumeText,
                    project: remembered.projectContext,
                    jobDetails: meeting.jobDetails,
                    interviewStyle: meeting.interviewStyle,
                    candidateDetails: meeting.candidateDetails,
                }),
            },
            ...history,
        ])
        const agentMessage = await addChat({ meetingId, role: "AGENT", text: reply })
        revalidatePath(`/meetings/${meetingId}`)
        return { ok: true, data: { messages: [userMessage, agentMessage] } }
    } catch (error) {
        return fail(error)
    }
}

export async function speakSummaryAction(meetingId: string): Promise<ActionResult<{ audio: string }>> {
    try {
        const meeting = await getMeeting(meetingId)
        if (!meeting?.summary) return { ok: false, error: "This meeting has no summary to play yet." }
        const audio = await speak(meeting.summary, meeting.language, meeting.speaker)
        return { ok: true, data: { audio } }
    } catch (error) {
        return fail(error)
    }
}

export async function setPlanAction(plan: PlanName): Promise<ActionResult> {
    try {
        await setPlan(plan)
        revalidatePath("/upgrade")
        revalidatePath("/agents")
        revalidatePath("/meetings")
        return { ok: true, data: undefined }
    } catch (error) {
        return fail(error)
    }
}
