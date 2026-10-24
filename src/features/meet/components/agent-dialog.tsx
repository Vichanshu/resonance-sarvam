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
import { createAgentAction, updateAgentAction } from "@/features/meet/actions"
import { DEFAULT_INSTRUCTIONS, LANGUAGES, SPEAKERS } from "@/features/meet/constants"
import type { AgentItem } from "@/features/meet/types"

export function AgentDialog({
    open,
    onOpenChange,
    agent,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    agent?: AgentItem | null
}) {
    const router = useRouter()
    const [pending, setPending] = useState(false)

    async function onSubmit(formData: FormData) {
        setPending(true)
        const result = agent
            ? await updateAgentAction(formData)
            : await createAgentAction(formData)
        setPending(false)
        if (!result.ok) {
            toast.error(result.error)
            return
        }
        onOpenChange(false)
        router.refresh()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{agent ? "Edit agent" : "New agent"}</DialogTitle>
                    <DialogDescription>
                        This agent joins your meeting, listens with Sarvam, and answers in its own voice.
                    </DialogDescription>
                </DialogHeader>
                <form action={onSubmit} className="grid gap-3" key={agent?.id ?? "new"}>
                    {agent && <input type="hidden" name="id" value={agent.id} />}
                    <div className="grid gap-1.5">
                        <Label htmlFor="agent-name">Name</Label>
                        <Input id="agent-name" name="name" defaultValue={agent?.name} placeholder="Research interviewer" required />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="agent-instructions">Instructions</Label>
                        <Textarea
                            id="agent-instructions"
                            name="instructions"
                            defaultValue={agent?.instructions ?? DEFAULT_INSTRUCTIONS}
                            className="min-h-28"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="agent-language">Language</Label>
                            <NativeSelect id="agent-language" name="language" className="w-full" defaultValue={agent?.language ?? "en-IN"}>
                                {LANGUAGES.map((language) => (
                                    <NativeSelectOption key={language.id} value={language.id}>{language.label}</NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="agent-speaker">Voice</Label>
                            <NativeSelect id="agent-speaker" name="speaker" className="w-full" defaultValue={agent?.speaker ?? "shubh"}>
                                {SPEAKERS.map((speaker) => (
                                    <NativeSelectOption key={speaker.id} value={speaker.id}>{speaker.label}</NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save agent"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
