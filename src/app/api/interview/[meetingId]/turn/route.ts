import { interviewError, interviewTurn } from "@/features/meet/session"

export async function POST(
    request: Request,
    context: { params: Promise<{ meetingId: string }> },
) {
    try {
        const { meetingId } = await context.params
        const form = await request.formData()
        const speaker = typeof form.get("speakerName") === "string" ? String(form.get("speakerName")) : "Candidate"
        return interviewTurn(meetingId, form, speaker)
    } catch (error) {
        console.error(error)
        return interviewError(error)
    }
}
