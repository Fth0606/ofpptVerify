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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border shadow-2xl transition-all duration-500 ease-in-out">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] dark:opacity-[0.05]" />
      
      <div className="relative flex h-20 items-center gap-3 px-6 overflow-hidden">
        {/* Shimmer Effect */}
        <div className="absolute inset-0 shimmer opacity-20" />
        
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2E7D32] via-[#1565C0] to-[#78909C] p-[2px] shadow-lg">
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-sidebar">
            <ShieldCheck className="h-6 w-6 text-primary animate-pulse" />
          </div>
        </div>
        <div className="relative">
          <h1 className="text-lg font-bold tracking-tight brand-gradient-text">OFPPT Verify</h1>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Institutionnel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6 relative z-10">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 relative overflow-hidden",
                isActive
                  ? "bg-secondary/10 text-secondary sidebar-glow"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-primary hover:-translate-y-0.5"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-0 h-full w-1 bg-secondary shadow-[0_0_10px_theme('colors.secondary.DEFAULT')]" />
              )}
              <item.icon className={cn(
                "h-5 w-5 transition-all duration-300", 
                isActive ? "text-secondary scale-110" : "group-hover:text-primary group-hover:scale-110"
              )} />
              <span className="font-semibold tracking-tight">{item.label}</span>
              
              {!isActive && (
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border relative z-10">
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
            JD
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold truncate">Administrateur</p>
            <p className="text-[10px] text-muted-foreground truncate">admin@ofppt.ma</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
