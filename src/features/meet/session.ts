import "temporal-polyfill/full/global"
import { Temporal } from "temporal-polyfill"

import { NextResponse } from "next/server"

import { db } from "@/prisma/db"
import {
    MeetError,
    endSharedInterview,
    noteCandidateReply,
} from "./data"
import { chat, liveInstructions, speak, transcribe } from "./sarvam"

async function meetingWithAgent(meetingId: string) {
    const meeting = await db.orm.public.Meeting.where({ id: meetingId }).include("agent").first()
    if (!meeting) throw new MeetError("Meeting not found.")
    if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED") {
        throw new MeetError("This interview has ended.")
    }
    return meeting
}

function secondsRemaining(startedAt: { epochMilliseconds: number | bigint } | null, minutes: number | null) {
    if (!minutes || !startedAt) return null
    const start = Number(startedAt.epochMilliseconds)
    return Math.round((start + minutes * 60_000 - Date.now()) / 1000)
}

export async function interviewTurn(meetingId: string, form: FormData, fallbackName: string) {
    const meeting = await meetingWithAgent(meetingId)
    let startedAt = meeting.startedAt
    if (meeting.status === "UPCOMING") {
        startedAt = Temporal.Now.instant()
        await db.orm.public.Meeting.where({ id: meetingId }).update({
            status: "ACTIVE",
            startedAt,
        })
    }
    const remainingSeconds = secondsRemaining(startedAt, meeting.durationMinutes)

    const requestedName = typeof form.get("speakerName") === "string" ? String(form.get("speakerName")).trim() : ""
    const speakerName = requestedName || meeting.candidateName || fallbackName || "Candidate"
    if (requestedName && requestedName !== meeting.candidateName) {
        await db.orm.public.Meeting.where({ id: meetingId }).update({ candidateName: requestedName })
    }

    if (form.get("opening") === "1") {
        const existing = await db.orm.public.TranscriptTurn.where({ meetingId }).all()
        if (existing.length > 0) return NextResponse.json({ skipped: true })
        const reply = await chat([
            { role: "system", content: instructionsFor(meeting, remainingSeconds) },
            { role: "user", content: "The candidate just joined. Start the interview. Mention how long you have if a time limit was set." },
        ])
        await db.orm.public.TranscriptTurn.create({
            meetingId,
            role: "AGENT",
            speakerName: meeting.agent.name,
            text: reply,
        })
        const audio = await speak(reply, meeting.agent.language, meeting.agent.speaker)
        return NextResponse.json({
            skipped: false,
            userText: "",
            agentText: reply,
            audio,
            remainingSeconds,
            durationMinutes: meeting.durationMinutes,
        })
    }

    const typed = form.get("text")
    const audioFile = form.get("audio")
    let transcript = typeof typed === "string" ? typed.trim() : ""
    if (!transcript) {
        if (!(audioFile instanceof Blob) || audioFile.size < 800) {
            return NextResponse.json({ skipped: true })
        }
        transcript = await transcribe(audioFile, meeting.agent.language)
    }
    if (!transcript) return NextResponse.json({ skipped: true, remainingSeconds })

    if (remainingSeconds !== null && remainingSeconds <= 0) {
        const goodbye = "That is our time. Thank you for speaking with me. This interview is now over."
        await db.orm.public.TranscriptTurn.create({
            meetingId,
            role: "USER",
            speakerName,
            text: transcript,
        })
        await db.orm.public.TranscriptTurn.create({
            meetingId,
            role: "AGENT",
            speakerName: meeting.agent.name,
            text: goodbye,
        })
        const audio = await speak(goodbye, meeting.agent.language, meeting.agent.speaker)
        await endSharedInterview(meetingId)
        return NextResponse.json({
            skipped: false,
            ended: true,
            userText: transcript,
            agentText: goodbye,
            audio,
            remainingSeconds: 0,
        })
    }

    const materials = await noteCandidateReply(meetingId, transcript)
    await db.orm.public.TranscriptTurn.create({
        meetingId,
        role: "USER",
        speakerName,
        text: transcript,
    })
    const turns = await db.orm.public.TranscriptTurn
        .where({ meetingId })
        .orderBy((turn) => turn.createdAt.asc())
        .all()
    const reply = await chat([
        {
            role: "system",
            content: liveInstructions({
                name: meeting.agent.name,
                instructions: meeting.agent.instructions,
                resume: materials.resumeText,
                project: materials.projectContext,
                githubUrl: materials.githubUrl,
                jobDetails: meeting.jobDetails,
                interviewStyle: meeting.interviewStyle,
                candidateName: requestedName || meeting.candidateName,
                candidateDetails: materials.candidateDetails,
                durationMinutes: meeting.durationMinutes,
                secondsLeft: remainingSeconds,
            }),
        },
        ...turns.slice(-12).map((turn) => ({
            role: turn.role === "AGENT" ? "assistant" as const : "user" as const,
            content: turn.text,
        })),
    ])
    await db.orm.public.TranscriptTurn.create({
        meetingId,
        role: "AGENT",
        speakerName: meeting.agent.name,
        text: reply,
    })
    const audio = await speak(reply, meeting.agent.language, meeting.agent.speaker)
    return NextResponse.json({
        skipped: false,
        userText: transcript,
        agentText: reply,
        audio,
        remainingSeconds,
        durationMinutes: meeting.durationMinutes,
    })
}

function instructionsFor(meeting: {
    agent: { name: string; instructions: string }
    resumeText: string | null
    projectContext: string | null
    githubUrl: string | null
    jobDetails: string | null
    interviewStyle: string | null
    candidateName: string | null
    candidateDetails: string | null
    durationMinutes: number | null
}, secondsLeft: number | null) {
    return liveInstructions({
        name: meeting.agent.name,
        instructions: meeting.agent.instructions,
        resume: meeting.resumeText,
        project: meeting.projectContext,
        githubUrl: meeting.githubUrl,
        jobDetails: meeting.jobDetails,
        interviewStyle: meeting.interviewStyle,
        candidateName: meeting.candidateName,
        candidateDetails: meeting.candidateDetails,
        durationMinutes: meeting.durationMinutes,
        secondsLeft,
    })
}

export async function interviewEnd(meetingId: string) {
    await endSharedInterview(meetingId)
    return NextResponse.json({ ok: true })
}

export function interviewError(error: unknown) {
    const message = error instanceof MeetError || error instanceof Error
        ? error.message
        : "Could not continue the interview."
    const status = error instanceof MeetError ? 400 : 500
    return NextResponse.json({ error: message }, { status })
}
