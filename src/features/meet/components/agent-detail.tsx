"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { removeAgentAction } from "@/features/meet/actions"
import { LANGUAGES, SPEAKERS, statusLabel } from "@/features/meet/constants"
import type { AgentItem, MeetingItem } from "@/features/meet/types"
import { AgentDialog } from "./agent-dialog"

export function AgentDetail({
    agent,
    meetings,
}: {
    agent: AgentItem
    meetings: MeetingItem[]
}) {
    const router = useRouter()
    const [editOpen, setEditOpen] = useState(false)
    const [removeOpen, setRemoveOpen] = useState(false)
    const [pending, setPending] = useState(false)
    const language = LANGUAGES.find((item) => item.id === agent.language)?.label ?? agent.language
    const speaker = SPEAKERS.find((item) => item.id === agent.speaker)?.label ?? agent.speaker

    async function remove() {
        setPending(true)
        const result = await removeAgentAction(agent.id)
        setPending(false)
        if (!result.ok) {
            toast.error(result.error)
            return
        }
        router.push("/agents")
        router.refresh()
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight">{agent.name}</h2>
                    <p className="text-sm text-muted-foreground">{language} · {speaker}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
                    <Button variant="destructive" onClick={() => setRemoveOpen(true)}>Remove</Button>
                </div>
            </div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{agent.instructions}</p>
            </div>
            <div className="space-y-2">
                <h3 className="text-sm font-medium">Meetings</h3>
                {meetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This agent has not joined a meeting yet.</p>
                ) : (
                    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                        {meetings.map((meeting) => (
                            <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="flex items-center justify-between border-b px-4 py-3 last:border-b-0 hover:bg-muted/40">
                                <span className="font-medium tracking-tight">{meeting.name}</span>
                                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <Badge variant="outline">{statusLabel(meeting.status)}</Badge>
                                    {format(new Date(meeting.createdAt), "MMM d, yyyy")}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
                <Link href="/meetings" className={buttonVariants({ variant: "outline", size: "sm" })}>Schedule a meeting</Link>
            </div>
            <AgentDialog open={editOpen} onOpenChange={setEditOpen} agent={agent} />
            <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this agent?</AlertDialogTitle>
                        <AlertDialogDescription>Meetings that use this agent will be removed too.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="destructive" disabled={pending} onClick={remove}>Remove</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
