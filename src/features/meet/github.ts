const REPO = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i

export function githubRepoFromText(text: string) {
    const match = text.match(REPO)
    if (!match) return null
    const owner = match[1]
    const repo = match[2].replace(/\.git$/, "").replace(/[).,]+$/, "")
    return {
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}`,
    }
}

async function github(path: string) {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "resonance-interviewer",
    }
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    const response = await fetch(`https://api.github.com${path}`, { headers })
    if (response.status === 404) return null
    if (!response.ok) {
        throw new Error(`GitHub could not be read (${response.status}).`)
    }
    return response.json() as Promise<unknown>
}

function clip(value: string, max: number) {
    return value.length <= max ? value : `${value.slice(0, max)}\n…`
}

export async function loadProjectContext(url: string) {
    const parsed = githubRepoFromText(url)
    if (!parsed) return "The link is not a GitHub repository. Ask for a public github.com link."

    try {
        const repo = await github(`/repos/${parsed.owner}/${parsed.repo}`) as {
            description?: string | null
            default_branch?: string
            language?: string | null
            private?: boolean
            html_url?: string
            topics?: string[]
        } | null
        if (!repo) {
            return `Could not open ${parsed.url}. It may be private or mistyped. Ask for a public repository link.`
        }

        const [languages, readme, tree] = await Promise.all([
            github(`/repos/${parsed.owner}/${parsed.repo}/languages`) as Promise<Record<string, number> | null>,
            github(`/repos/${parsed.owner}/${parsed.repo}/readme`) as Promise<{ content?: string } | null>,
            github(`/repos/${parsed.owner}/${parsed.repo}/git/trees/${repo.default_branch ?? "HEAD"}?recursive=1`) as Promise<{
                tree?: { path?: string; type?: string; size?: number }[]
            } | null>,
        ])

        const readmeText = readme?.content
            ? clip(Buffer.from(readme.content, "base64").toString("utf8"), 3500)
            : "No README."

        const files = (tree?.tree ?? [])
            .filter((file) => file.type === "blob" && file.path)
            .map((file) => file.path as string)
            .filter((path) => !/node_modules|dist|build|\.lock$|package-lock|pnpm-lock|yarn\.lock|\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(path))

        const preferred = files.filter((path) =>
            /(^|\/)(package\.json|pyproject\.toml|go\.mod|Cargo\.toml|pom\.xml)$/.test(path)
            || /^src\/.*\.(ts|tsx|js|jsx|py|go|java|rs|kt)$/.test(path)
        )
        const chosen = [...new Set([...preferred, ...files])].slice(0, 4)
        const sources: string[] = []
        for (const path of chosen) {
            const file = await github(`/repos/${parsed.owner}/${parsed.repo}/contents/${path}`) as { content?: string; encoding?: string } | null
            if (!file?.content || file.encoding !== "base64") continue
            const text = Buffer.from(file.content, "base64").toString("utf8")
            if (text.length > 40000) continue
            sources.push(`FILE ${path}\n${clip(text, 1800)}`)
        }

        return clip([
            `Repository: ${repo.html_url ?? parsed.url}`,
            `Description: ${repo.description || "None"}`,
            `Primary language: ${repo.language || "Unknown"}`,
            `Languages: ${languages ? Object.keys(languages).join(", ") : "Unknown"}`,
            `Topics: ${(repo.topics ?? []).join(", ") || "None"}`,
            `Files:\n${files.slice(0, 80).join("\n") || "None listed"}`,
            `README:\n${readmeText}`,
            sources.join("\n\n"),
        ].filter(Boolean).join("\n\n"), 12000)
    } catch (error) {
        const message = error instanceof Error ? error.message : "GitHub could not be read."
        return `${message} Ask the candidate to confirm the repository is public.`
    }
}
