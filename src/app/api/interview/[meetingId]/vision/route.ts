import { NextResponse } from "next/server"

import { db } from "@/prisma/db"
import { inspectFrame, speak } from "@/features/meet/sarvam"

export async function POST(
    request: Request,
    context: { params: Promise<{ meetingId: string }> },
) {
    try {
        const { meetingId } = await context.params
        const meeting = await db.orm.public.Meeting.where({ id: meetingId }).include("agent").first()
        if (!meeting || meeting.status === "COMPLETED" || meeting.status === "CANCELLED") {
            return NextResponse.json({ ok: true })
        }
        const form = await request.formData()
        const noted = form.get("note")
        let warning = typeof noted === "string" ? noted.trim() : ""
        if (!warning) {
            const frame = form.get("frame")
            if (!(frame instanceof Blob) || frame.size < 500) return NextResponse.json({ ok: true })
            warning = (await inspectFrame(Buffer.from(await frame.arrayBuffer()))) ?? ""
        }
        if (!warning) return NextResponse.json({ ok: true })
        await db.orm.public.TranscriptTurn.create({
            meetingId,
            role: "AGENT",
            speakerName: meeting.agent.name,
            text: warning,
        })
        const audio = await speak(warning, meeting.agent.language, meeting.agent.speaker)
        return NextResponse.json({ ok: false, agentText: warning, audio })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ ok: true })
    }
}
