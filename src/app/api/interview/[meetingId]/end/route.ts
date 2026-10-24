import { interviewEnd, interviewError } from "@/features/meet/session"

export async function POST(
    _request: Request,
    context: { params: Promise<{ meetingId: string }> },
) {
    try {
        const { meetingId } = await context.params
        return interviewEnd(meetingId)
    } catch (error) {
        console.error(error)
        return interviewError(error)
    }
}
