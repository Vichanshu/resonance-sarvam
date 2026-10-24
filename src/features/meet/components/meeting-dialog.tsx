"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { createMeetingAction, updateMeetingAction } from "@/features/meet/actions"
import type { MeetingItem } from "@/features/meet/types"

export function MeetingDialog({
    open,
    onOpenChange,
    agents,
    meeting,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    agents: { id: string; name: string }[]
    meeting?: MeetingItem | null
}) {
    const router = useRouter()
    const [pending, setPending] = useState(false)

    async function onSubmit(formData: FormData) {
        setPending(true)
        const result = meeting
            ? await updateMeetingAction(formData)
            : await createMeetingAction(formData)
        setPending(false)
        if (!result.ok) {
            toast.error(result.error)
            return
        }
        onOpenChange(false)
        if (!meeting && result.data) {
            router.push(`/meetings/${result.data.id}`)
            return
        }
        router.refresh()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-lg">
                <DialogHeader className="shrink-0 pr-8">
                    <DialogTitle>{meeting ? "Edit interview" : "New interview"}</DialogTitle>
                    <DialogDescription>
                        Job, style, and candidate notes. The agent asks for anything you leave blank.
                    </DialogDescription>
                </DialogHeader>
                <form action={onSubmit} className="flex min-h-0 flex-1 flex-col gap-3" key={meeting?.id ?? "new"}>
                    {meeting && <input type="hidden" name="id" value={meeting.id} />}
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-1.5 sm:col-span-2">
                                <Label htmlFor="meeting-name">Name</Label>
                                <Input id="meeting-name" name="name" defaultValue={meeting?.name} placeholder="Technical interview" required />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="meeting-agent">Agent</Label>
                                <NativeSelect id="meeting-agent" name="agentId" className="w-full" defaultValue={meeting?.agentId ?? agents[0]?.id}>
                                    {agents.map((agent) => (
                                        <NativeSelectOption key={agent.id} value={agent.id}>{agent.name}</NativeSelectOption>
                                    ))}
                                </NativeSelect>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="meeting-length">Length</Label>
                                <NativeSelect id="meeting-length" name="durationMinutes" className="w-full" defaultValue={String(meeting?.durationMinutes ?? 30)}>
                                    <NativeSelectOption value="">No limit</NativeSelectOption>
                                    <NativeSelectOption value="15">15 minutes</NativeSelectOption>
                                    <NativeSelectOption value="20">20 minutes</NativeSelectOption>
                                    <NativeSelectOption value="30">30 minutes</NativeSelectOption>
                                    <NativeSelectOption value="45">45 minutes</NativeSelectOption>
                                    <NativeSelectOption value="60">60 minutes</NativeSelectOption>
                                </NativeSelect>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="meeting-candidate">Candidate</Label>
                                <Input id="meeting-candidate" name="candidateName" defaultValue={meeting?.candidateName ?? ""} placeholder="Name" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="meeting-github">GitHub</Label>
                                <Input id="meeting-github" name="githubUrl" defaultValue={meeting?.githubUrl ?? ""} placeholder="https://github.com/owner/repo" />
                            </div>
                            <div className="grid gap-1.5 sm:col-span-2">
                                <Label htmlFor="meeting-job">Job</Label>
                                <Textarea id="meeting-job" name="jobDetails" defaultValue={meeting?.jobDetails ?? ""} placeholder="Role and what a strong answer shows" className="min-h-14" />
                            </div>
                            <div className="grid gap-1.5 sm:col-span-2">
                                <Label htmlFor="meeting-style">Style</Label>
                                <Textarea id="meeting-style" name="interviewStyle" defaultValue={meeting?.interviewStyle ?? ""} placeholder="One follow-up at a time, focus on their project" className="min-h-14" />
                            </div>
                            <div className="grid gap-1.5 sm:col-span-2">
                                <Label htmlFor="meeting-background">Candidate notes</Label>
                                <Textarea id="meeting-background" name="candidateDetails" defaultValue={meeting?.candidateDetails ?? ""} placeholder="What you already know" className="min-h-14" />
                            </div>
                            <div className="grid gap-1.5 sm:col-span-2">
                                <Label htmlFor="meeting-resume">Resume</Label>
                                <Textarea id="meeting-resume" name="resumeText" defaultValue={meeting?.resumeText ?? ""} placeholder="Paste a resume, or leave this blank" className="min-h-16" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mx-0 mb-0 shrink-0 rounded-lg">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={pending || agents.length === 0}>{pending ? "Saving" : "Save interview"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
