import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { MeetingDetailView } from "@/features/meet/components/meeting-detail"
import { getMeeting, listAgentOptions } from "@/features/meet/data"

export const metadata: Metadata = { title: "Meeting" }
export const instant = false

export default async function MeetingPage({
    params,
}: {
    params: Promise<{ meetingId: string }>
}) {
    const { meetingId } = await params
    const [meeting, agents] = await Promise.all([
        getMeeting(meetingId),
        listAgentOptions(),
    ])
    if (!meeting) notFound()

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto">
            <PageHeader title="Meetings" />
            <MeetingDetailView meeting={meeting} agents={agents} />
        </div>
    )
}
