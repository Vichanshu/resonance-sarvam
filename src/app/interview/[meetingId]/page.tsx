import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CandidateJoin } from "@/features/meet/components/candidate-join"
import { getSharedMeeting } from "@/features/meet/data"

export const metadata: Metadata = { title: "Interview" }
export const instant = false

export default async function InterviewPage({
    params,
}: {
    params: Promise<{ meetingId: string }>
}) {
    const { meetingId } = await params
    const meeting = await getSharedMeeting(meetingId)
    if (!meeting) notFound()

    return <CandidateJoin meeting={meeting} />
}
