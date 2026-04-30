import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "./ui/button";

export function AppLayout() {
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-64 flex flex-col min-h-screen">
        <header className="h-20 flex items-center justify-between px-10 border-b border-primary/5 sticky top-0 bg-background/60 backdrop-blur-xl z-30 shadow-sm">
          <div className="flex flex-col">
            <h2 className="text-xl font-black tracking-tight uppercase italic brand-gradient-text">
              {location.pathname === "/dashboard" ? "Panorama Analytique" : 
               location.pathname.includes("students") ? "Registre Étudiants" :
               location.pathname.includes("mismatched") ? "Anomalies OCR" :
               location.pathname.includes("verified") ? "Conformités" :
               location.pathname.replace("/", "").replace("-", " ")}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Système de Certification Digitale OFPPT</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-secondary/5 border border-secondary/10">
              <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-[10px] font-black text-secondary tracking-widest uppercase">Serveur Connecté</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-11 w-11 rounded-2xl hover:bg-primary/5 hover:text-primary transition-all duration-500 border border-transparent hover:border-primary/10 active:scale-95"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            
            <div className="h-8 w-[1px] bg-border/40" />
            
            <Button className="h-11 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 font-black text-xs uppercase tracking-widest px-6 transition-all hover:-translate-y-0.5 active:scale-95">
              Assistance
            </Button>
          </div>
        </header>

        <main className="flex-1 p-8 page-transition">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
