import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Canvas } from "@/components/canvas";
import { Search } from "@/components/search";
import { Textarea } from "@/components/ui/textarea";

export default function App({ children }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-2">
            <SidebarTrigger />
          </div>
          <div className="border border-dashed border-black rounded-lg absolute bottom-0 right-0 z-10 bg-white p-3 m-5 gap-5 flex flex-col">
            <Search />
            <Textarea placeholder="Give ai research guidelines..." />
          </div>
          <main className="flex-1 overflow-hidden">
            <Canvas />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
