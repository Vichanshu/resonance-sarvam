"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CallRoom } from "./call-room"

export function CandidateJoin({
    meeting,
}: {
    meeting: {
        id: string
        name: string
        status: string
        agentName: string
        candidateName: string | null
        jobDetails: string | null
        durationMinutes: number | null
        startedAt: string | null
    }
}) {
    const [name, setName] = useState(meeting.candidateName ?? "")
    const [joined, setJoined] = useState(false)

    if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED") {
        return (
            <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
                <h1 className="text-xl font-semibold tracking-tight">This interview has ended</h1>
                <p className="max-w-md text-sm text-muted-foreground">
                    The transcript and summary are on the hiring manager&apos;s meeting dashboard.
                </p>
            </div>
        )
    }

    if (!joined) {
        return (
            <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-6 bg-background p-6">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Interview with {meeting.agentName}</p>
                    <h1 className="text-2xl font-semibold tracking-tight">{meeting.name}</h1>
                    {meeting.jobDetails && (
                        <p className="text-sm leading-relaxed text-muted-foreground">{meeting.jobDetails}</p>
                    )}
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="candidate-name">Your name</Label>
                    <Input id="candidate-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
                </div>
                <Button disabled={!name.trim()} onClick={() => setJoined(true)}>Join interview</Button>
            </div>
        )
    }

    return (
        <CallRoom
            share
            meetingId={meeting.id}
            meetingName={meeting.name}
            agentName={meeting.agentName}
            candidateName={name.trim()}
            durationMinutes={meeting.durationMinutes}
            startedAt={meeting.startedAt}
        />
    )
}
