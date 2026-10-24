import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { AgentDetail } from "@/features/meet/components/agent-detail"
import { getAgent } from "@/features/meet/data"

export const metadata: Metadata = { title: "Agent" }
export const instant = false

export default async function AgentPage({
    params,
}: {
    params: Promise<{ agentId: string }>
}) {
    const { agentId } = await params
    const result = await getAgent(agentId)
    if (!result) notFound()

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto">
            <PageHeader title="Agents" />
            <AgentDetail agent={result.agent} meetings={result.meetings} />
        </div>
    )
}
