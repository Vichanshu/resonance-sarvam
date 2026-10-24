import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { MeetingsView } from "@/features/meet/components/meetings-view"
import { getUsage, listAgentOptions, listMeetings } from "@/features/meet/data"

export const metadata: Metadata = { title: "Meetings" }
export const instant = false

export default async function MeetingsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; page?: string; status?: string; agentId?: string }>
}) {
    const params = await searchParams
    const page = Math.max(1, Number(params.page) || 1)
    const query = params.q ?? ""
    const status = params.status ?? ""
    const agentId = params.agentId ?? ""
    const [result, agents, usage] = await Promise.all([
        listMeetings({ search: query, status, agentId, page }),
        listAgentOptions(),
        getUsage(),
    ])

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto">
            <PageHeader title="Meetings" />
            <MeetingsView
                items={result.items}
                page={page}
                totalPages={result.totalPages}
                total={result.total}
                query={query}
                status={status}
                agentId={agentId}
                agents={agents}
                usage={usage}
            />
        </div>
    )
}
