import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Canvas } from "@/components/canvas";
import { Search } from "@/components/search";
import { MarkdownBox } from "@/components/ui/markdownbox";
import { TriggerFlow } from "./components/trigger-flow";
import { useState } from "react";

export default function App({ children }) {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [mapcontent, setMapcontent] = useState({});
  const [activeSummary, setActiveSummary] = useState(null);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-2">
            <SidebarTrigger />
          </div>

          <div className="border border-dashed border-black rounded-lg absolute bottom-0 right-0 z-10 bg-white p-3 m-5 gap-5 flex flex-col w-[380px]">
            <Search onSelect={setSelectedTicker} />

            {activeSummary !== null && (
              <MarkdownBox>{activeSummary}</MarkdownBox>
            )}

            <TriggerFlow
              selected={selectedTicker}
              setMapcontent={setMapcontent}
            />
          </div>

          <main className="flex-1 overflow-hidden">
            <Canvas
              selected={selectedTicker}
              mapcontent={mapcontent}
              onSelectNode={(node) => {
                // ignore clicks on the company/root node
                if (!node || node.id === "root") return;
                // update summary box with this node’s summary (fallback to empty string)
                setActiveSummary(node?.data?.summary ?? "");
              }}
            />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
