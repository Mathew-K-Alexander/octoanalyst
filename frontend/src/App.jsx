import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Canvas } from '@/components/canvas';

export default function App({ children }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-2">
            <SidebarTrigger />
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
