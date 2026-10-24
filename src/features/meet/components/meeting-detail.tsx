"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { BookOpenText, FileText, Mic, Sparkles } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
    cancelMeetingAction,
    endMeetingAction,
    removeMeetingAction,
    sendChatAction,
    speakSummaryAction,
} from "@/features/meet/actions"
import { statusLabel } from "@/features/meet/constants"
import type { ChatItem, MeetingDetail } from "@/features/meet/types"
import { MeetingDialog } from "./meeting-dialog"

function durationLabel(seconds: number | null) {
    if (seconds == null) return "Not started"
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return minutes === 0 ? `${rest}s` : `${minutes}m ${rest}s`
}

function Highlight({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const parts = text.split(new RegExp(`(${escaped})`, "ig"))
    return (
        <>
            {parts.map((part, index) => part.toLowerCase() === query.trim().toLowerCase()
                ? <mark key={index} className="rounded bg-primary/15 px-0.5">{part}</mark>
                : <span key={index}>{part}</span>)}
        </>
    )
}

export function MeetingDetailView({
    meeting,
    agents,
}: {
    meeting: MeetingDetail
    agents: { id: string; name: string }[]
}) {
    const router = useRouter()
    const [editOpen, setEditOpen] = useState(false)
    const [removeOpen, setRemoveOpen] = useState(false)
    const [pending, setPending] = useState(false)
    const [query, setQuery] = useState("")
    const [messages, setMessages] = useState<ChatItem[]>(meeting.messages)
    const [draft, setDraft] = useState("")
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const turns = useMemo(
        () => meeting.turns.filter((turn) => turn.text.toLowerCase().includes(query.trim().toLowerCase())),
        [meeting.turns, query],
    )

    async function run(action: () => Promise<{ ok: boolean; error?: string }>, next?: string) {
        setPending(true)
        const result = await action()
        setPending(false)
        if (!result.ok) {
            toast.error(result.error)
            return
        }
        if (next) router.push(next)
        router.refresh()
    }

    async function ask(event: React.FormEvent) {
        event.preventDefault()
        const text = draft.trim()
        if (!text) return
        setPending(true)
        const result = await sendChatAction(meeting.id, text)
        setPending(false)
        if (!result.ok) {
            toast.error(result.error)
            return
        }
        setDraft("")
        setMessages((current) => [...current, ...result.data.messages])
    }

    async function playRecap() {
        setPending(true)
        const result = await speakSummaryAction(meeting.id)
        setPending(false)
        if (!result.ok) {
            toast.error(result.error)
            return
        }
        setAudioUrl(`data:audio/wav;base64,${result.data.audio}`)
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-semibold tracking-tight">{meeting.name}</h2>
                        <Badge variant="outline">{statusLabel(meeting.status)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {meeting.agentName} · {format(new Date(meeting.createdAt), "MMM d, yyyy p")} · {durationLabel(meeting.durationSeconds)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(meeting.status === "UPCOMING" || meeting.status === "ACTIVE") && (
                        <Link href={`/call/${meeting.id}`} className={buttonVariants()}>
                            <Mic /> {meeting.status === "ACTIVE" ? "Rejoin" : "Start meeting"}
                        </Link>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => {
                            const link = `${window.location.origin}/interview/${meeting.id}`
                            void navigator.clipboard.writeText(link)
                            toast.success("Candidate link copied")
                        }}
                    >
                        Copy candidate link
                    </Button>
                    {meeting.status === "PROCESSING" && (
                        <Button disabled={pending} onClick={() => run(() => endMeetingAction(meeting.id))}>Finish summary</Button>
                    )}
                    {meeting.status === "UPCOMING" && (
                        <>
                            <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
                            <Button variant="outline" disabled={pending} onClick={() => run(() => cancelMeetingAction(meeting.id))}>Cancel</Button>
                        </>
                    )}
                    <Button variant="destructive" onClick={() => setRemoveOpen(true)}>Remove</Button>
                </div>
            </div>

            {meeting.status === "UPCOMING" && (
                <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
                    <h3 className="font-medium tracking-tight">Technical interview</h3>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                        {meeting.agentName} uses the job, the interview style, and whatever is known about the candidate. Missing details are asked in the call. Share this link with the candidate. The transcript and summary stay on this meeting.
                    </p>
                    <p className="mt-3 max-w-xl break-all text-sm">{`/interview/${meeting.id}`}</p>
                    {meeting.durationMinutes && (
                        <p className="mt-2 text-sm text-muted-foreground">
                            The interviewer will close the meeting after {meeting.durationMinutes} minutes.
                        </p>
                    )}
                    {meeting.githubUrl && (
                        <p className="mt-3 max-w-xl break-all text-sm">
                            <a href={meeting.githubUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{meeting.githubUrl}</a>
                        </p>
                    )}
                    {meeting.resumeText && (
                        <p className="mt-2 text-sm text-muted-foreground">The resume is attached.</p>
                    )}
                    {!meeting.githubUrl && !meeting.resumeText && (
                        <p className="mt-3 text-sm text-muted-foreground">Both can be pasted in the call.</p>
                    )}
                </div>
            )}
            {meeting.status === "ACTIVE" && (
                <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
                    <h3 className="font-medium tracking-tight">This meeting is live</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Rejoin to keep talking with {meeting.agentName}.</p>
                </div>
            )}
            {meeting.status === "CANCELLED" && (
                <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
                    <h3 className="font-medium tracking-tight">Meeting cancelled</h3>
                    <p className="mt-1 text-sm text-muted-foreground">This meeting will not take place.</p>
                </div>
            )}
            {meeting.status === "PROCESSING" && (
                <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
                    <h3 className="font-medium tracking-tight">Summary needs another pass</h3>
                    <p className="mt-1 text-sm text-muted-foreground">The transcript is saved. Finish the summary when Sarvam is available.</p>
                </div>
            )}
            {meeting.status === "COMPLETED" && (
                <Tabs defaultValue="summary">
                    <TabsList variant="line">
                        <TabsTrigger value="summary"><BookOpenText /> Summary</TabsTrigger>
                        <TabsTrigger value="transcript"><FileText /> Transcript</TabsTrigger>
                        <TabsTrigger value="recording"><Mic /> Recap</TabsTrigger>
                        <TabsTrigger value="chat"><Sparkles /> Ask</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary" className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{meeting.summary}</p>
                    </TabsContent>
                    <TabsContent value="transcript" className="space-y-3">
                        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the transcript" />
                        <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                            {turns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No matching lines.</p>
                            ) : turns.map((turn) => (
                                <div key={turn.id}>
                                    <p className="text-xs font-medium text-muted-foreground">{turn.speakerName} · {format(new Date(turn.createdAt), "p")}</p>
                                    <p className="text-sm leading-relaxed"><Highlight text={turn.text} query={query} /></p>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="recording" className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                        <p className="text-sm text-muted-foreground">
                            Play a spoken recap of this meeting in {meeting.agentName}&apos;s voice.
                        </p>
                        <Button disabled={pending} onClick={playRecap}>Play recap</Button>
                        {audioUrl && <audio src={audioUrl} controls className="w-full" />}
                    </TabsContent>
                    <TabsContent value="chat" className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                        <div className="max-h-80 space-y-3 overflow-y-auto">
                            {messages.length === 0 && (
                                <p className="text-sm text-muted-foreground">Ask about decisions, open questions, or anything in the summary.</p>
                            )}
                            {messages.map((message) => (
                                <div key={message.id} className={message.role === "USER" ? "ml-8" : "mr-8"}>
                                    <p className="text-xs font-medium text-muted-foreground">{message.role === "USER" ? "You" : meeting.agentName}</p>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={ask} className="grid gap-2">
                            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What did we decide?" />
                            <Button type="submit" disabled={pending} className="justify-self-end">Send</Button>
                        </form>
                    </TabsContent>
                </Tabs>
            )}

            <MeetingDialog open={editOpen} onOpenChange={setEditOpen} agents={agents} meeting={meeting} />
            <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this meeting?</AlertDialogTitle>
                        <AlertDialogDescription>The transcript and summary will be deleted.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="destructive" disabled={pending} onClick={() => run(() => removeMeetingAction(meeting.id), "/meetings")}>Remove</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
