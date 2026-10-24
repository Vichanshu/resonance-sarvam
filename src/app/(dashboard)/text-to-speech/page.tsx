import type { Metadata } from "next"
import { TextToSpeechView } from "@/features/text-to-speech/view/text-to-speech-view"

export const metadata: Metadata = { "title": "text-to-speech" }

export default function TextToSpeech() {
    return (
        <>
            <TextToSpeechView />
        </>
    )
}