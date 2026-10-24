import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { CallRoom } from "@/features/meet/components/call-room"
import { getMeeting } from "@/features/meet/data"

export const metadata: Metadata = { title: "Call" }
export const instant = false

export default async function CallPage({
    params,
}: {
    params: Promise<{ meetingId: string }>
}) {
    const { meetingId } = await params
    const meeting = await getMeeting(meetingId)
    if (!meeting) notFound()

    if (meeting.status !== "UPCOMING" && meeting.status !== "ACTIVE") {
        return (
            <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
                <h1 className="text-xl font-semibold tracking-tight">This meeting has ended</h1>
                <p className="max-w-md text-sm text-muted-foreground">
                    Open the meeting to read the transcript, summary, and follow-up chat.
                </p>
                <Link href={`/meetings/${meeting.id}`} className={buttonVariants()}>View meeting</Link>
            </div>
        )
    }

    return (
        <CallRoom
            meetingId={meeting.id}
            meetingName={meeting.name}
            agentName={meeting.agentName}
            durationMinutes={meeting.durationMinutes}
            startedAt={meeting.startedAt}
        />
    )
}
