"use client"

import Link from "next/link"
import { useState } from "react"
import { Bot, Plus } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AgentDialog } from "@/features/meet/components/agent-dialog"
import { MAX_FREE_AGENTS } from "@/features/meet/constants"
import type { AgentItem, Usage } from "@/features/meet/types"

export function AgentsView({
    items,
    page,
    totalPages,
    total,
    query,
    usage,
}: {
    items: AgentItem[]
    page: number
    totalPages: number
    total: number
    query: string
    usage: Usage
}) {
    const [open, setOpen] = useState(false)
    const blocked = usage.plan === "FREE" && usage.agentCount >= MAX_FREE_AGENTS
    const href = (nextPage: number) => {
        const params = new URLSearchParams()
        if (query) params.set("q", query)
        if (nextPage > 1) params.set("page", String(nextPage))
        const value = params.toString()
        return value ? `/agents?${value}` : "/agents"
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <form className="flex items-center gap-2" action="/agents">
                    <Input name="q" defaultValue={query} placeholder="Search agents" className="w-56" />
                    <Button type="submit" variant="outline">Search</Button>
                </form>
                {blocked ? (
                    <Link href="/upgrade" className={buttonVariants()}>Upgrade to add agents</Link>
                ) : (
                    <Button onClick={() => setOpen(true)}><Plus /> New agent</Button>
                )}
            </div>
            <p className="text-sm text-muted-foreground">
                {usage.plan === "PRO"
                    ? `${usage.agentCount} agents on the Pro plan.`
                    : `${usage.agentCount} of ${MAX_FREE_AGENTS} free agents used.`}
            </p>
            {items.length === 0 ? (
                <Empty className="border bg-card">
                    <EmptyHeader>
                        <EmptyMedia variant="icon"><Bot /></EmptyMedia>
                        <EmptyTitle>Create your first agent</EmptyTitle>
                        <EmptyDescription>
                            An agent follows your instructions and talks with you during a meeting.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                    {items.map((agent) => (
                        <Link
                            key={agent.id}
                            href={`/agents/${agent.id}`}
                            className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40"
                        >
                            <div className="min-w-0">
                                <p className="truncate font-medium tracking-tight">{agent.name}</p>
                                <p className="truncate text-sm text-muted-foreground">{agent.instructions}</p>
                            </div>
                            <p className="shrink-0 text-xs text-muted-foreground">
                                {agent.meetingCount} {agent.meetingCount === 1 ? "meeting" : "meetings"}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">{total} total</p>
                <div className="flex items-center gap-2">
                    <Link href={href(page - 1)} aria-disabled={page <= 1} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}>Previous</Link>
                    <span className="tabular-nums text-muted-foreground">{page} / {totalPages}</span>
                    <Link href={href(page + 1)} aria-disabled={page >= totalPages} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= totalPages && "pointer-events-none opacity-50")}>Next</Link>
                </div>
            </div>
            <AgentDialog open={open} onOpenChange={setOpen} />
        </div>
    )
}
