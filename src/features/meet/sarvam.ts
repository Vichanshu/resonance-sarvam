import { SUMMARY_SYSTEM } from "./constants"

const API = "https://api.sarvam.ai"

function key() {
    const value = process.env.SARVAM_API_KEY
    if (!value) {
        throw new Error("Add SARVAM_API_KEY to your environment to use meetings.")
    }
    return value
}

async function readError(response: Response) {
    const text = await response.text()
    try {
        const body = JSON.parse(text) as { error?: { message?: string }; message?: string }
        return body.error?.message || body.message || text
    } catch {
        return text || response.statusText
    }
}

export async function transcribe(audio: Blob, language: string) {
    const body = new FormData()
    const type = audio.type || "audio/webm"
    const extension = type.includes("wav") ? "wav" : type.includes("mp4") ? "mp4" : "webm"
    body.append("file", audio, `speech.${extension}`)
    body.append("model", "saaras:v3")
    body.append("language_code", language || "unknown")
    body.append("mode", "transcribe")

    const response = await fetch(`${API}/speech-to-text`, {
        method: "POST",
        headers: { "api-subscription-key": key() },
        body,
    })
    if (!response.ok) {
        throw new Error(await readError(response))
    }
    const json = (await response.json()) as { transcript?: string }
    return (json.transcript ?? "").trim()
}

type ChatMessage = {
    role: "system" | "user" | "assistant"
    content: string
}

export async function chat(messages: ChatMessage[]) {
    const response = await fetch(`${API}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "api-subscription-key": key(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: process.env.SARVAM_CHAT_MODEL || "sarvam-105b",
            temperature: 0.3,
            messages,
        }),
    })
    if (!response.ok) {
        throw new Error(await readError(response))
    }
    const json = (await response.json()) as {
        choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[]
    }
    const content = json.choices?.[0]?.message?.content
    if (typeof content === "string") return content.trim()
    if (Array.isArray(content)) {
        return content.map((part) => part.text ?? "").join("").trim()
    }
    throw new Error("Sarvam returned an empty reply.")
}

export async function speak(text: string, language: string, speaker: string) {
    const spoken = text.replace(/[#*_`]/g, "").trim().slice(0, 1200)
    if (!spoken) throw new Error("Nothing to speak.")

    const response = await fetch(`${API}/text-to-speech`, {
        method: "POST",
        headers: {
            "api-subscription-key": key(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text: spoken,
            target_language_code: language,
            speaker,
            model: "bulbul:v3",
            pace: 1,
        }),
    })
    if (!response.ok) {
        throw new Error(await readError(response))
    }
    const json = (await response.json()) as { audios?: string[] }
    const audio = json.audios?.[0]
    if (!audio) throw new Error("Sarvam returned no audio.")
    return audio
}

export function liveInstructions(input: {
    name: string
    instructions: string
    resume: string | null
    project: string | null
    githubUrl: string | null
    jobDetails: string | null
    interviewStyle: string | null
    candidateName: string | null
    candidateDetails: string | null
    durationMinutes?: number | null
    secondsLeft?: number | null
}) {
    const thin = [input.resume, input.candidateDetails, input.githubUrl, input.project].filter((value) => value?.trim()).length < 2
    return `You are ${input.name}, a technical interviewer. This is a live interview. Sound like a person: calm, specific, and curious. Never announce that you are an AI.

Job the candidate is interviewing for:
${input.jobDetails?.trim() || "The hiring manager has not described the job yet. Ask what role they are here for only if you cannot tell, then continue."}

Interview style requested by the hiring manager:
${input.interviewStyle?.trim() || "A practical technical interview. One question at a time, with follow-ups on the candidate's real work."}

Hiring-manager notes:
${input.instructions}

Candidate name: ${input.candidateName?.trim() || "Not provided yet."}
What the hiring manager already knows about the candidate:
${input.candidateDetails?.trim() || "Very little."}

Candidate resume:
${input.resume?.trim() || "Not provided yet."}

GitHub repository: ${input.githubUrl || "Not provided yet."}
Project material you have actually read:
${input.project?.trim() || "Nothing has been read from GitHub yet."}

How to interview:
- Match the requested interview style and the job. Ask questions a hiring manager for that role would ask.
- ${thin ? "You do not have enough candidate material. Ask the candidate for the missing pieces: their background, the role they want, a public GitHub link, and a short resume. After they answer, use what they told you. Do not invent a career for them." : "Use the resume, the job, and the GitHub project. Ask about a real file, decision, or tradeoff."}
- If they give a github.com link, it will be read before your next question. Refer only to material you have actually been given.
- Ask one question. After they answer, ask one follow-up about what they just said, and weigh it against the job.
- Do not list questions, give away the answer, or turn the interview into coaching.
- Time box: ${input.durationMinutes ? `This interview is ${input.durationMinutes} minutes. About ${Math.max(0, Math.ceil((input.secondsLeft ?? input.durationMinutes * 60) / 60))} minutes remain.` : "No time limit was set."}
- If more than two minutes remain, continue the interview.
- If two minutes or less remain, do not open a new topic. Ask for one closing thought, then thank them.
- If no time remains, thank them and say the interview is over. Do not ask another question.
- Speak in one or two short sentences. No markdown, lists, or emoji.
- Use the language the candidate is speaking, unless the hiring manager named a language.`
}

export async function summarizeTranscript(lines: { speaker: string; text: string }[], context = "") {
    if (lines.length === 0) {
        return "### Overview\nThe interview ended before anyone spoke.\n\n### Notes\n- No transcript was captured."
    }
    return chat([
        { role: "system", content: SUMMARY_SYSTEM },
        {
            role: "user",
            content: `${context ? `${context}\n\n` : ""}Summarize the following interview transcript:\n${lines
                .map((line) => `${line.speaker}: ${line.text}`)
                .join("\n")}`,
        },
    ])
}

export function followUpInstructions(input: {
    name: string
    instructions: string
    summary: string | null
    resume: string | null
    project: string | null
    jobDetails?: string | null
    interviewStyle?: string | null
    candidateDetails?: string | null
}) {
    return `You are ${input.name}, the technical interviewer who just finished this interview.
Job:
${input.jobDetails?.trim() || "Not specified."}

Interview style:
${input.interviewStyle?.trim() || "Practical technical interview."}

Interview summary:
${input.summary || "No summary is available."}

Candidate notes:
${input.candidateDetails?.trim() || "None."}

Resume:
${input.resume?.trim() || "Not provided."}

Project material:
${input.project?.trim() || "No GitHub project was read."}

Hiring guidance:
${input.instructions}

Answer questions about the interview, the candidate's project, and what was said. If the material does not contain the answer, say so. Be concise.`
}
