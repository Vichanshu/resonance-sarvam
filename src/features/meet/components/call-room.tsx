"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { endMeetingAction, startMeetingAction } from "@/features/meet/actions"
import type { TurnItem } from "@/features/meet/types"

function encodeWav(buffers: Float32Array[], sampleRate: number) {
    const length = buffers.reduce((total, buffer) => total + buffer.length, 0)
    const pcm = new Int16Array(length)
    let offset = 0
    for (const buffer of buffers) {
        for (let index = 0; index < buffer.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, buffer[index] ?? 0))
            pcm[offset] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
            offset += 1
        }
    }
    const wav = new ArrayBuffer(44 + pcm.byteLength)
    const view = new DataView(wav)
    const write = (position: number, value: string) => {
        for (let index = 0; index < value.length; index += 1) view.setUint8(position + index, value.charCodeAt(index))
    }
    write(0, "RIFF")
    view.setUint32(4, 36 + pcm.byteLength, true)
    write(8, "WAVE")
    write(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    write(36, "data")
    view.setUint32(40, pcm.byteLength, true)
    new Int16Array(wav, 44).set(pcm)
    return new Blob([wav], { type: "audio/wav" })
}

export function CallRoom({
    meetingId,
    meetingName,
    agentName,
    share = false,
    candidateName = "",
    durationMinutes = null,
    startedAt = null,
}: {
    meetingId: string
    meetingName: string
    agentName: string
    share?: boolean
    candidateName?: string
    durationMinutes?: number | null
    startedAt?: string | null
}) {
    const router = useRouter()
    const cameraRef = useRef<MediaStream | null>(null)
    const busy = useRef(false)
    const mutedRef = useRef(false)
    const openingRequested = useRef(false)
    const [phase, setPhase] = useState<"lobby" | "live" | "ending" | "done">("lobby")
    const turnEndpoint = share ? `/api/interview/${meetingId}/turn` : `/api/meetings/${meetingId}/turn`

    function speakerBody(body: FormData) {
        if (candidateName.trim()) body.append("speakerName", candidateName.trim())
        return body
    }
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [remaining, setRemaining] = useState<number | null>(null)
    const closing = useRef(false)
    const leaveRef = useRef<() => void>(() => undefined)
    const closeFromServerRef = useRef<(json: { ended?: boolean }) => Promise<void>>(async () => undefined)
    const speakerBodyRef = useRef<(body: FormData) => FormData>((body) => body)
    const [muted, setMuted] = useState(false)
    const [listening, setListening] = useState(false)
    const [speaking, setSpeaking] = useState(false)
    const [turns, setTurns] = useState<TurnItem[]>([])
    const [draft, setDraft] = useState("")
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        mutedRef.current = muted
    }, [muted])

    const attachCamera = useCallback((element: HTMLVideoElement | null) => {
        if (!element) return
        const stream = cameraRef.current
        if (!stream) return
        if (element.srcObject !== stream) element.srcObject = stream
        element.muted = true
        void element.play().catch(() => undefined)
    }, [])

    useEffect(() => {
        let cancelled = false
        let stream: MediaStream | null = null

        async function startCamera() {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraError("This browser cannot open the camera.")
                return
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: false,
                })
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop())
                    return
                }
                cameraRef.current = stream
                setCameraError(null)
                document.querySelectorAll<HTMLVideoElement>("[data-call-camera]").forEach((element) => {
                    element.srcObject = stream
                    element.muted = true
                    void element.play().catch(() => undefined)
                })
            } catch (error) {
                const name = error instanceof DOMException ? error.name : ""
                setCameraError(
                    name === "NotAllowedError"
                        ? "Camera permission is blocked. Allow it in the browser and reload this call."
                        : name === "NotFoundError"
                            ? "No camera was found on this computer."
                            : "The camera could not be started.",
                )
            }
        }

        void startCamera()
        return () => {
            cancelled = true
            stream?.getTracks().forEach((track) => track.stop())
            cameraRef.current = null
        }
    }, [])

    useEffect(() => {
        if (phase !== "live") return
        let stopped = false
        let stream: MediaStream | null = null
        let context: AudioContext | null = null
        let processor: ScriptProcessorNode | null = null
        let frame = 0
        let samples: Float32Array[] = []
        let capturing = false
        let speakingNow = false
        let silenceAt = 0
        let spokeAt = 0

        const sendBlob = async (blob: Blob) => {
            if (blob.size < 800 || busy.current) return
            busy.current = true
            setListening(false)
            try {
                const body = new FormData()
                body.append("audio", blob, "speech.wav")
                const response = await fetch(turnEndpoint, { method: "POST", body: speakerBodyRef.current(body) })
                const json = await response.json()
                if (!response.ok) throw new Error(json.error || "The agent could not answer.")
                if (!json.skipped) await playReply(json.userText, json.agentText, json.audio)
                if (json.ended) await closeFromServerRef.current({ ended: true })
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "The agent could not answer.")
            } finally {
                busy.current = false
            }
        }

        const playReply = async (userText: string, agentText: string, audio: string) => {
            const now = new Date().toISOString()
            setTurns((current) => [
                ...current,
                { id: crypto.randomUUID(), role: "USER", speakerName: "You", text: userText, createdAt: now },
                { id: crypto.randomUUID(), role: "AGENT", speakerName: agentName, text: agentText, createdAt: now },
            ])
            setSpeaking(true)
            const player = new Audio(`data:audio/wav;base64,${audio}`)
            await new Promise<void>((resolve) => {
                player.onended = () => resolve()
                player.onerror = () => resolve()
                void player.play().catch(() => resolve())
            })
            setSpeaking(false)
        }

        navigator.mediaDevices.getUserMedia({ audio: true }).then((next) => {
            if (stopped) {
                next.getTracks().forEach((track) => track.stop())
                return
            }
            stream = next
            context = new AudioContext()
            void context.resume()
            const source = context.createMediaStreamSource(next)
            const analyser = context.createAnalyser()
            analyser.fftSize = 2048
            source.connect(analyser)
            processor = context.createScriptProcessor(4096, 1, 1)
            processor.onaudioprocess = (event) => {
                if (!capturing) return
                samples.push(new Float32Array(event.inputBuffer.getChannelData(0)))
            }
            const silent = context.createGain()
            silent.gain.value = 0
            source.connect(processor)
            processor.connect(silent)
            silent.connect(context.destination)
            const data = new Uint8Array(analyser.fftSize)
            const rate = context.sampleRate

            const tick = () => {
                if (stopped) return
                frame = requestAnimationFrame(tick)
                if (busy.current || mutedRef.current) {
                    capturing = false
                    speakingNow = false
                    return
                }
                analyser.getByteTimeDomainData(data)
                let sum = 0
                for (const value of data) {
                    const sample = (value - 128) / 128
                    sum += sample * sample
                }
                const rms = Math.sqrt(sum / data.length)
                const now = performance.now()
                if (rms > 0.035) {
                    if (!speakingNow) {
                        speakingNow = true
                        capturing = true
                        spokeAt = now
                        samples = []
                        setListening(true)
                    }
                    silenceAt = 0
                } else if (speakingNow) {
                    if (!silenceAt) silenceAt = now
                    if (now - silenceAt > 850 && now - spokeAt > 450) {
                        speakingNow = false
                        capturing = false
                        setListening(false)
                        const blob = encodeWav(samples, rate)
                        samples = []
                        void sendBlob(blob)
                    }
                }
            }
            frame = requestAnimationFrame(tick)
        }).catch(() => {
            toast.error("Allow the microphone to talk with the agent, or type instead.")
        })

        return () => {
            stopped = true
            cancelAnimationFrame(frame)
            processor?.disconnect()
            stream?.getTracks().forEach((track) => track.stop())
            void context?.close()
        }
    }, [phase, meetingId, agentName, turnEndpoint, candidateName])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [turns])

    useEffect(() => {
        if (phase !== "live" || !durationMinutes) return
        const start = startedAt ? new Date(startedAt).getTime() : Date.now()
        const endAt = start + durationMinutes * 60 * 1000
        const tick = () => {
            const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
            setRemaining(left)
            if (left <= 0) leaveRef.current()
        }
        tick()
        const id = window.setInterval(tick, 1000)
        return () => window.clearInterval(id)
    }, [phase, durationMinutes, startedAt])

    async function requestOpening() {
        if (openingRequested.current) return
        openingRequested.current = true
        busy.current = true
        try {
            const body = speakerBody(new FormData())
            body.append("opening", "1")
            const response = await fetch(turnEndpoint, { method: "POST", body })
            const json = await response.json()
            if (!response.ok) throw new Error(json.error || "The agent could not answer.")
            if (!json.skipped && json.agentText) {
                const now = new Date().toISOString()
                const userText = typeof json.userText === "string" ? json.userText.trim() : ""
                setTurns((current) => [
                    ...current,
                    ...(userText
                        ? [{ id: crypto.randomUUID(), role: "USER" as const, speakerName: "You", text: userText, createdAt: now }]
                        : []),
                    { id: crypto.randomUUID(), role: "AGENT" as const, speakerName: agentName, text: json.agentText, createdAt: now },
                ])
                if (typeof json.audio === "string" && json.audio) {
                    setSpeaking(true)
                    const player = new Audio(`data:audio/wav;base64,${json.audio}`)
                    await new Promise<void>((resolve) => {
                        player.onended = () => resolve()
                        player.onerror = () => resolve()
                        void player.play().catch(() => resolve())
                    })
                    setSpeaking(false)
                }
                if (json.ended) await closeFromServer({ ended: true })
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "The agent could not answer.")
        } finally {
            busy.current = false
        }
    }

    async function join() {
        if (!share) {
            const result = await startMeetingAction(meetingId)
            if (!result.ok) {
                toast.error(result.error)
                return
            }
        }
        setPhase("live")
        void requestOpening()
    }

    leaveRef.current = () => {
        void leave()
    }

    async function closeFromServer(json: { ended?: boolean; agentText?: string; audio?: string; userText?: string }) {
        if (!json.ended) return
        closing.current = true
        const agentText = json.agentText
        if (agentText) {
            const now = new Date().toISOString()
            const userText = json.userText?.trim()
            setTurns((current) => [
                ...current,
                ...(userText
                    ? [{ id: crypto.randomUUID(), role: "USER" as const, speakerName: "You", text: userText, createdAt: now }]
                    : []),
                { id: crypto.randomUUID(), role: "AGENT" as const, speakerName: agentName, text: agentText, createdAt: now },
            ])
        }
        if (json.audio) {
            const player = new Audio(`data:audio/wav;base64,${json.audio}`)
            await new Promise<void>((resolve) => {
                player.onended = () => resolve()
                player.onerror = () => resolve()
                void player.play().catch(() => resolve())
            })
        }
        if (share) {
            setPhase("done")
            return
        }
        router.push(`/meetings/${meetingId}`)
        router.refresh()
    }
    closeFromServerRef.current = closeFromServer
    speakerBodyRef.current = speakerBody

    async function leave() {
        if (closing.current) return
        closing.current = true
        setPhase("ending")
        if (share) {
            const response = await fetch(`/api/interview/${meetingId}/end`, { method: "POST" })
            if (!response.ok) {
                const json = await response.json().catch(() => ({}))
                toast.error(json.error || "The interview could not be saved.")
            }
            setPhase("done")
            return
        }
        const result = await endMeetingAction(meetingId)
        if (!result.ok) toast.error(result.error)
        router.push(`/meetings/${meetingId}`)
        router.refresh()
    }

    async function sendText(event: React.FormEvent) {
        event.preventDefault()
        const text = draft.trim()
        if (!text || busy.current) return
        busy.current = true
        setDraft("")
        try {
            const body = speakerBody(new FormData())
            body.append("text", text)
            const response = await fetch(turnEndpoint, { method: "POST", body })
            const json = await response.json()
            if (!response.ok) throw new Error(json.error || "The agent could not answer.")
            if (!json.skipped) {
                const now = new Date().toISOString()
                setTurns((current) => [
                    ...current,
                    { id: crypto.randomUUID(), role: "USER", speakerName: "You", text: json.userText, createdAt: now },
                    { id: crypto.randomUUID(), role: "AGENT", speakerName: agentName, text: json.agentText, createdAt: now },
                ])
                setSpeaking(true)
                const player = new Audio(`data:audio/wav;base64,${json.audio}`)
                await new Promise<void>((resolve) => {
                    player.onended = () => resolve()
                    player.onerror = () => resolve()
                    void player.play().catch(() => resolve())
                })
                setSpeaking(false)
                if (json.ended) await closeFromServer({ ended: true })
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "The agent could not answer.")
        } finally {
            busy.current = false
        }
    }

    if (phase === "done") {
        return (
            <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
                <h1 className="text-xl font-semibold tracking-tight">Interview saved</h1>
                <p className="max-w-md text-sm text-muted-foreground">
                    {agentName} has the transcript and summary. You can close this page.
                </p>
            </div>
        )
    }

    if (phase === "lobby") {
        return (
            <div className="flex min-h-svh flex-col bg-background">
                <header className="flex items-center justify-between border-b px-4 py-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Lobby</p>
                        <h1 className="text-lg font-semibold tracking-tight">{meetingName}</h1>
                    </div>
                    {!share && (
                        <Link href={`/meetings/${meetingId}`} className="text-sm text-muted-foreground hover:text-foreground">Back</Link>
                    )}
                </header>
                <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 p-6">
                    <video ref={attachCamera} data-call-camera autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-muted object-cover ring-1 ring-foreground/10" />
                    {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-medium tracking-tight">{agentName} is ready</p>
                            <p className="text-sm text-muted-foreground">Your camera stays on this device. Speech goes to Sarvam.</p>
                        </div>
                        <Button onClick={join}>{share ? "Join interview" : "Join meeting"}</Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-svh flex-col bg-background">
            <header className="flex items-center justify-between border-b px-4 py-3">
                <div>
                    <h1 className="font-semibold tracking-tight">{meetingName}</h1>
                    <p className="text-sm text-muted-foreground">
                        {speaking ? `${agentName} is speaking` : listening ? "Listening" : `With ${agentName}`}
                        {remaining !== null && (
                            <span className={remaining < 120 ? " text-destructive" : ""}>
                                {" "}· {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")} left
                            </span>
                        )}
                    </p>
                </div>
                {phase === "ending" && <Loader2 className="size-4 animate-spin" />}
            </header>
            <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="flex flex-col gap-4">
                    <video ref={attachCamera} data-call-camera autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-muted object-cover ring-1 ring-foreground/10" />
                    {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
                    <div className={`rounded-xl p-4 ring-1 ring-foreground/10 ${speaking ? "bg-primary/5" : "bg-card"}`}>
                        <p className="text-sm font-medium">{agentName}</p>
                        <p className="text-sm text-muted-foreground">
                            {muted ? "Microphone muted. You can still type." : "Speak naturally. A short pause sends your turn."}
                        </p>
                    </div>
                </div>
                <div className="flex min-h-80 flex-col rounded-xl bg-card ring-1 ring-foreground/10">
                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {turns.length === 0 && <p className="text-sm text-muted-foreground">The transcript will appear here.</p>}
                        {turns.map((turn) => (
                            <div key={turn.id}>
                                <p className="text-xs font-medium text-muted-foreground">{turn.speakerName}</p>
                                <p className="text-sm leading-relaxed">{turn.text}</p>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                    <form onSubmit={sendText} className="flex gap-2 border-t p-3">
                        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type instead of speaking" />
                        <Button type="submit" variant="outline">Send</Button>
                    </form>
                </div>
            </div>
            <footer className="flex items-center justify-center gap-2 border-t px-4 py-3">
                <Button variant="outline" onClick={() => setMuted((value) => !value)}>
                    {muted ? <MicOff /> : <Mic />} {muted ? "Unmute" : "Mute"}
                </Button>
                <Button variant="destructive" disabled={phase === "ending"} onClick={leave}>
                    <PhoneOff /> End
                </Button>
            </footer>
        </div>
    )
}
