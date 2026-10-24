"use client"

import Link from "next/link"
import { useState } from "react"
import { format } from "date-fns"
import { Plus, Video } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { cn } from "@/lib/utils"
import { MAX_FREE_MEETINGS, MEETING_STATUSES, statusLabel } from "@/features/meet/constants"
import type { MeetingItem, Usage } from "@/features/meet/types"
import { MeetingDialog } from "./meeting-dialog"

export function MeetingsView({
    items,
    page,
    totalPages,
    total,
    query,
    status,
    agentId,
    agents,
    usage,
}: {
    items: MeetingItem[]
    page: number
    totalPages: number
    total: number
    query: string
    status: string
    agentId: string
    agents: { id: string; name: string }[]
    usage: Usage
}) {
    const [open, setOpen] = useState(false)
    const blocked = usage.plan === "FREE" && usage.meetingCount >= MAX_FREE_MEETINGS
    const href = (nextPage: number) => {
        const params = new URLSearchParams()
        if (query) params.set("q", query)
        if (status) params.set("status", status)
        if (agentId) params.set("agentId", agentId)
        if (nextPage > 1) params.set("page", String(nextPage))
        const value = params.toString()
        return value ? `/meetings?${value}` : "/meetings"
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <form className="flex flex-wrap items-center gap-2" action="/meetings">
                    <Input name="q" defaultValue={query} placeholder="Search meetings" className="w-48" />
                    <NativeSelect name="status" defaultValue={status}>
                        <NativeSelectOption value="">All statuses</NativeSelectOption>
                        {MEETING_STATUSES.map((value) => (
                            <NativeSelectOption key={value} value={value}>{statusLabel(value)}</NativeSelectOption>
                        ))}
                    </NativeSelect>
                    <NativeSelect name="agentId" defaultValue={agentId}>
                        <NativeSelectOption value="">All agents</NativeSelectOption>
                        {agents.map((agent) => (
                            <NativeSelectOption key={agent.id} value={agent.id}>{agent.name}</NativeSelectOption>
                        ))}
                    </NativeSelect>
                    <Button type="submit" variant="outline">Filter</Button>
                </form>
                {agents.length === 0 ? (
                    <Link href="/agents" className={buttonVariants()}>Create an agent first</Link>
                ) : blocked ? (
                    <Link href="/upgrade" className={buttonVariants()}>Upgrade to add meetings</Link>
                ) : (
                    <Button onClick={() => setOpen(true)}><Plus /> New meeting</Button>
                )}
            </div>
            <p className="text-sm text-muted-foreground">
                {usage.plan === "PRO"
                    ? `${usage.meetingCount} meetings on the Pro plan.`
                    : `${usage.meetingCount} of ${MAX_FREE_MEETINGS} free meetings used.`}
            </p>
            {items.length === 0 ? (
                <Empty className="border bg-card">
                    <EmptyHeader>
                        <EmptyMedia variant="icon"><Video /></EmptyMedia>
                        <EmptyTitle>No meetings yet</EmptyTitle>
                        <EmptyDescription>
                            Start a meeting with an agent. You will get a live transcript, a summary, and a follow-up chat.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                    {items.map((meeting) => (
                        <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40">
                            <div className="min-w-0">
                                <p className="truncate font-medium tracking-tight">{meeting.name}</p>
                                <p className="text-sm text-muted-foreground">{meeting.agentName} · {format(new Date(meeting.createdAt), "MMM d, p")}</p>
                            </div>
                            <Badge variant="outline">{statusLabel(meeting.status)}</Badge>
                        </Link>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">{total} total</p>
                <div className="flex items-center gap-2">
                    <Link href={href(page - 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}>Previous</Link>
                    <span className="tabular-nums text-muted-foreground">{page} / {totalPages}</span>
                    <Link href={href(page + 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= totalPages && "pointer-events-none opacity-50")}>Next</Link>
                </div>
            </div>
            <MeetingDialog open={open} onOpenChange={setOpen} agents={agents} />
        </div>
    )
}
