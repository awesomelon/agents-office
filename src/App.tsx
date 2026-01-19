import { useEffect } from "react";
import { OfficeCanvas } from "./components/office/OfficeCanvas";
import { Inbox } from "./components/ui/Inbox";
import { Header } from "./components/ui/Header";
import { useTauriEvents } from "./hooks/useTauriEvents";

function App() {
  useTauriEvents();

  useEffect(() => {
    // Prevent context menu on right-click for cleaner UX
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-inbox-bg">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <OfficeCanvas />
        </div>
        <Inbox />
      </div>
    </div>
  );
}

export default App;
