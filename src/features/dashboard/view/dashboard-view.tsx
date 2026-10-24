import { Background } from "../components/background";
import { PageHeader } from "../../../components/page-header";
import { DashboardHeader } from "../components/dashboard-header";
import { TextInputPanel } from "../components/text-input";
import { QuickActionsPanel } from "../components/quick-action-panel";


export function DashboardView() {
    return (
        <div className="relative">
            <PageHeader title="Dashboard" className="lg:hidden" />
            <Background />

            <div className="relative space-y-8 p-4 lg:p-16">
                <DashboardHeader />
                <TextInputPanel />
                <QuickActionsPanel />
            </div>


        </div>
    )
}