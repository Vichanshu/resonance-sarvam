
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { cookies } from "next/headers"
import DashboardSidebar from "@/features/dashboard/components/dashboard-sidebar"
import { Suspense } from "react"
import LoadingAnimation from "@/features/loader/loader"



type child = {
    children: React.ReactNode
}


export default function DashboardLayout({ children }: child) {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <DashboardContent>{children}</DashboardContent>
        </Suspense>
    )
}


export async function DashboardContent({ children }: child) {
    const cookieStore = await cookies()
    const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

    return (
        <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
            <DashboardSidebar />
            <SidebarInset className="min-h-0 min-w-0">
                <main className="flex min-h-0 flex-1 flex-col">
                    {children}
                </main>
            </SidebarInset>

        </SidebarProvider>
    )
}
