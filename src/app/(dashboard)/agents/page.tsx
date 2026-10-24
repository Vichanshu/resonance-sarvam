import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { AgentsView } from "@/features/meet/components/agents-view"
import { getUsage, listAgents } from "@/features/meet/data"

export const metadata: Metadata = { title: "Agents" }
export const instant = false

export default async function AgentsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; page?: string }>
}) {
    const params = await searchParams
    const page = Math.max(1, Number(params.page) || 1)
    const query = params.q ?? ""
    const [result, usage] = await Promise.all([
        listAgents({ search: query, page }),
        getUsage(),
    ])

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto">
            <PageHeader title="Agents" />
            <AgentsView
                items={result.items}
                page={page}
                totalPages={result.totalPages}
                total={result.total}
                query={query}
                usage={usage}
            />
        </div>
    )
}
