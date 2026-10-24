"use client"

import Image from "next/image"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarTrigger,
    SidebarMenu,
    SidebarMenuItem,
    SidebarRail,
    SidebarMenuButton,
    SidebarGroupLabel,
    SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { OrganizationSwitcher, useClerk, UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { AudioLines, Bot, Headphones, Home, LayoutGrid, LucideIcon, Settings, Sparkles, Video, Volume2 } from "lucide-react"
import { useState } from "react"
import { usePathname } from "next/navigation"

interface MenuItem {
    title: string;
    url?: string;
    icon: LucideIcon;
    onClick?: () => void;
};

interface NavSectionProps {
    label?: string;
    items: MenuItem[];
    pathname: string;
};




function NavSection({ label, items, pathname }: NavSectionProps) {
    return (
        <SidebarGroup>
            {label && (
                <SidebarGroupLabel className="text-[13px] uppercase text-muted-foreground">
                    {label}
                </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                isActive={
                                    item.url
                                        ? item.url === "/"
                                            ? pathname === "/"
                                            : pathname.startsWith(item.url)
                                        : false
                                }
                                render={item.url ? <Link href={item.url} /> : undefined}
                                onClick={item.onClick}
                                tooltip={item.title}
                                className="h-9 px-3 py-2 text-[13px] tracking-tight font-medium border border-transparent data-[active=true]:border-border data-[active=true]:shadow-[0px_1px_1px_0px_rgba(44,54,53,0.03),inset_0px_0px_0px_2px_white]"
                            >
                                <item.icon />
                                <span>{item.title}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}






export default function DashboardSidebar() {
    const pathname = usePathname();
    const clerk = useClerk()
    const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);


    const mainMenuItems: MenuItem[] = [
        {
            title: "Dashboard",
            url: "/",
            icon: Home,
        },
        {
            title: "Explore voices",
            url: "/voices",
            icon: LayoutGrid,
        },
        {
            title: "Text to speech",
            url: "/text-to-speech",
            icon: AudioLines,
        },
        {
            title: "Voice cloning",
            icon: Volume2
        },
        {
            title: "Meetings",
            url: "/meetings",
            icon: Video,
        },
        {
            title: "Agents",
            url: "/agents",
            icon: Bot,
        },
        {
            title: "Upgrade",
            url: "/upgrade",
            icon: Sparkles,
        },
    ];


    const othersMenuItems: MenuItem[] = [
        {
            title: "Settings",
            icon: Settings,
            onClick: () => clerk.openOrganizationProfile(),
        },
        {
            title: "Help and support",
            url: "mailto:vichanshu@gmail.com",
            icon: Headphones,
        },
    ];






    return (
        <Sidebar>

            <SidebarHeader className="flex flex-col gap-4 pt-4">
                <div className="flex items-center gap-2 pl-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
                    <Image
                        src="/logo.svg"
                        alt="Resonance"
                        width={24}
                        height={24}
                        className="rounded-sm"
                    />
                    <span className="group-data-[collapsible=icon]:hidden font-semibold text-lg tracking-tighter text-foreground">
                        Resonance
                    </span>
                    <SidebarTrigger className="ml-auto " />
                </div>

                <SidebarMenu>
                    <SidebarMenuItem>
                        <OrganizationSwitcher
                            hidePersonal
                            fallback={
                                <Skeleton
                                    className="h-8.5 w-full group-data-[collapsible=icon]:size-8 rounded-md border bg-white"
                                />
                            }
                            appearance={{
                                elements: {
                                    rootBox:
                                        "w-full! group-data-[collapsible=icon]:w-auto! group-data-[collapsible=icon]:flex! group-data-[collapsible=icon]:justify-center!",
                                    organizationSwitcherTrigger:
                                        "w-full! justify-between! bg-white! border! border-border! rounded-md! pl-1! pr-2! py-1! gap-3! group-data-[collapsible=icon]:w-auto! group-data-[collapsible=icon]:p-1! shadow-[0px_1px_1.5px_0px_rgba(44,54,53,0.03)]!",
                                    organizationPreview: "gap-2!",
                                    organizationPreviewAvatarBox: "size-6! rounded-sm!",
                                    organizationPreviewTextContainer:
                                        "text-xs! tracking-tight! font-medium! text-foreground! group-data-[collapsible=icon]:hidden!",
                                    organizationPreviewMainIdentifier: "text-[13px]!",
                                    organizationSwitcherTriggerIcon:
                                        "size-4! text-sidebar-foreground! group-data-[collapsible=icon]:hidden!",
                                },
                            }}
                        />
                    </SidebarMenuItem>
                </SidebarMenu>

            </SidebarHeader>


            <SidebarContent>

                <NavSection
                    label="Main"
                    items={mainMenuItems}
                    pathname={pathname}
                />
                <NavSection
                    label="Others"
                    items={othersMenuItems}
                    pathname={pathname}
                />


            </SidebarContent>



            <SidebarFooter className="gap-3 py-3">

                <SidebarMenu>
                    <SidebarMenuItem>
                        <UserButton
                            showName
                            fallback={
                                <Skeleton className="h-8.5 w-full group-data-[collapsible=icon]:size-8 rounded-md border border-border bg-white" />
                            }
                            appearance={{
                                elements: {
                                    rootBox:
                                        "w-full! group-data-[collapsible=icon]:w-auto! group-data-[collapsible=icon]:flex! group-data-[collapsible=icon]:justify-center!",
                                    userButtonTrigger:
                                        "w-full! justify-between! bg-white! border! border-border! rounded-md! pl-1! pr-2! py-1! shadow-[0px_1px_1.5px_0px_rgba(44,54,53,0.03)]! group-data-[collapsible=icon]:w-auto! group-data-[collapsible=icon]:p-1! group-data-[collapsible=icon]:after:hidden! [--border:color-mix(in_srgb,transparent,var(--clerk-color-neutral,#000000)_15%)]!",
                                    userButtonBox: "flex-row-reverse! gap-2!",
                                    userButtonOuterIdentifier: "text-[13px]! tracking-tight! font-medium! text-foreground! pl-0! group-data-[collapsible=icon]:hidden!",
                                    userButtonAvatarBox: "size-6!",
                                }
                            }}
                        />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}