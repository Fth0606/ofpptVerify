import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileUp,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Tableau de Bord", icon: LayoutDashboard },
  { to: "/students", label: "Panneau de Vérification", icon: ShieldCheck },
  { to: "/import", label: "Importer Excel", icon: FileUp },
  { to: "/upload", label: "Téléverser Documents", icon: Upload },
  { to: "/mismatched", label: "Non Concordants", icon: AlertTriangle },
  { to: "/verified", label: "Vérifiés", icon: CheckCircle2 },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border shadow-lg text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border/50 px-6 backdrop-blur-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-foreground">OFPPT Verify</h1>
          <p className="text-[10px] text-muted-foreground font-medium tracking-wide">Vérification de Documents</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 relative overflow-hidden",
                isActive
                  ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
              )}
              <item.icon className={cn(
                "h-4 w-4 transition-transform duration-300 relative z-10", 
                isActive ? "scale-110 text-primary" : "group-hover:scale-110"
              )} />
              <span className="relative z-10 tracking-wide">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

    </aside>
  );
}
