"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { setPlanAction } from "@/features/meet/actions"
import { MAX_FREE_AGENTS, MAX_FREE_MEETINGS } from "@/features/meet/constants"
import type { Usage } from "@/features/meet/types"

const plans = [
    {
        name: "Free" as const,
        plan: "FREE" as const,
        price: "0",
        description: "Try an agent in a few meetings.",
        features: [
            `${MAX_FREE_AGENTS} agent`,
            `${MAX_FREE_MEETINGS} meetings`,
            "Live transcript",
            "Summary and follow-up chat",
        ],
    },
    {
        name: "Pro" as const,
        plan: "PRO" as const,
        price: "Unlimited",
        description: "Keep every agent and meeting in this workspace.",
        features: [
            "Unlimited agents",
            "Unlimited meetings",
            "Spoken recaps",
            "Same Sarvam voices",
        ],
    },
]

export function UpgradeView({ usage }: { usage: Usage }) {
    const router = useRouter()
    const [pending, setPending] = useState<"FREE" | "PRO" | null>(null)

    async function choose(plan: "FREE" | "PRO") {
        setPending(plan)
        const result = await setPlanAction(plan)
        setPending(null)
        if (!result.ok) {
            toast.error(result.error)
            return
        }
        router.refresh()
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-8 p-4 lg:p-8">
            <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight">
                    You are on the <span className="text-primary">{usage.plan === "PRO" ? "Pro" : "Free"}</span> plan
                </h2>
                <p className="text-sm text-muted-foreground">
                    {usage.agentCount} agents and {usage.meetingCount} meetings in this workspace.
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {plans.map((plan) => {
                    const current = usage.plan === plan.plan
                    return (
                        <div key={plan.plan} className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                                {current && <Badge>Current</Badge>}
                            </div>
                            <p className="text-3xl font-semibold tracking-tight">{plan.price}</p>
                            <p className="text-sm text-muted-foreground">{plan.description}</p>
                            <ul className="space-y-1 text-sm">
                                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                            </ul>
                            <Button
                                variant={plan.plan === "PRO" ? "default" : "outline"}
                                disabled={current || pending !== null}
                                onClick={() => choose(plan.plan)}
                            >
                                {current ? "Current plan" : pending === plan.plan ? "Saving" : plan.plan === "PRO" ? "Upgrade" : "Use Free"}
                            </Button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
