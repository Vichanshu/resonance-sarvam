import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { UpgradeView } from "@/features/meet/components/upgrade-view"
import { getUsage } from "@/features/meet/data"

export const metadata: Metadata = { title: "Upgrade" }
export const instant = false

export default async function UpgradePage() {
    const usage = await getUsage()
    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto">
            <PageHeader title="Upgrade" />
            <UpgradeView usage={usage} />
        </div>
    )
}
