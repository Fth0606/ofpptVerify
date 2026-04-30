import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileCheck, AlertCircle, FileX, ArrowRight, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiService, Student } from "@/lib/api-service";
import { toast } from "sonner";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

const Dashboard = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getStudents = async () => {
      try {
        const data = await apiService.fetchStudents();
        setStudents(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    getStudents();
  }, []);

  const stats = {
    total: students.length,
    verified: students.filter(s => s.status === "verified").length,
    mismatches: students.filter(s => s.status === "mismatch").length,
    missing: students.filter(s => s.status === "missing" || s.documentsUploaded === 0).length,
  };

  const recentActivity = students.slice(0, 5).map(s => ({
    student: s.Nom ? `${s.Nom} ${s.Prenom}` : "Étudiant",
    cin: s.cin,
    status: s.status,
    time: "Dernière mise à jour",
  }));

  const quickActions = [
    { title: "Importer Étudiants", description: "Fichier .xlsx", icon: Users, path: "/import", color: "bg-blue-100 text-blue-600" },
    { title: "Téléverser Docs", description: "Traitement OCR", icon: Upload, path: "/upload", color: "bg-green-100 text-green-600" },
    { title: "Revoir Non Concordants", description: "Corriger OCR", icon: AlertCircle, path: "/mismatched", color: "bg-red-100 text-red-600" },
  ];

  const pieData = [
    { name: "Vérifiés", value: stats.verified, color: "#2E7D32" },
    { name: "Non Concordants", value: stats.mismatches, color: "#ef4444" },
    { name: "Docs Manquants", value: stats.missing, color: "#1565C0" },
  ];

  const groupCounts: Record<string, number> = {};
  students.forEach(s => {
    if (s.CodeDiplome) {
      groupCounts[s.CodeDiplome] = (groupCounts[s.CodeDiplome] || 0) + 1;
    }
  });
  
  const barData = Object.keys(groupCounts).map(key => ({
    name: key,
    count: groupCounts[key]
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-12 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-6 duration-700">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight brand-gradient-text uppercase italic">Tableau de Bord Institutionnel</h1>
          <div className="text-muted-foreground font-medium flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
            Supervision analytique du processus de vérification OFPPT
          </div>
        </div>
        <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-2xl border border-border/40 backdrop-blur-sm">
          <div className="px-4 py-2 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Dernière Synchronisation</p>
            <p className="text-xs font-bold text-primary">Aujourd'hui, {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
          </div>
          <Button variant="secondary" size="icon" className="h-10 w-10 rounded-xl shadow-lg shadow-secondary/10">
            <ArrowRight className="h-4 w-4 rotate-[-45deg]" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Effectif Total", value: stats.total, icon: Users, color: "from-slate-500 to-slate-700", shadow: "shadow-slate-500/20", path: "/students", sub: "Étudiants enregistrés" },
          { label: "Dossiers Conformes", value: stats.verified, icon: FileCheck, color: "from-secondary to-secondary/80", shadow: "shadow-secondary/20", path: "/verified", sub: "Validation OCR complétée" },
          { label: "Anomalies Détectées", value: stats.mismatches, icon: AlertCircle, color: "from-destructive to-destructive/80", shadow: "shadow-destructive/20", path: "/mismatched", sub: "Discordances critiques" },
          { label: "Dossiers Incomplets", value: stats.missing, icon: FileX, color: "from-primary to-primary/80", shadow: "shadow-primary/20", path: "/students", sub: "Documents manquants" },
        ].map((item, idx) => (
          <Card 
            key={idx} 
            className={`glass-card border-none hover:-translate-y-2 transition-all duration-500 cursor-pointer group relative overflow-hidden shadow-xl ${item.shadow}`}
            onClick={() => navigate(item.path)}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${item.color}`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} text-white shadow-lg`}>
                <item.icon className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[9px] font-black tracking-tighter border-muted/30 uppercase">LIVE</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <span className="text-4xl font-black tracking-tighter mb-1">{loading ? "---" : item.value}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">{item.label}</span>
                <p className="text-[10px] font-medium text-muted-foreground italic mt-3 border-t border-muted/10 pt-2">{item.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-3 glass-card border-none shadow-2xl overflow-hidden group">
          <CardHeader className="pb-0 pt-8 px-8 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black tracking-tight uppercase">Statut des Dossiers</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 italic">Répartition volumétrique en temps réel</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
              <FileCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-center pb-8 pt-4 px-8">
            {stats.total > 0 ? (
              <>
                <div className="h-[280px] w-full relative">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                    <span className="text-3xl font-black text-primary">{Math.round((stats.verified / stats.total) * 100)}%</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Taux de Validité</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={105}
                        paddingAngle={6}
                        dataKey="value"
                        stroke="none"
                        animationBegin={300}
                        animationDuration={2000}
                        className="outline-none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            className="hover:opacity-90 transition-all cursor-pointer" 
                            style={{ filter: `drop-shadow(0 4px 6px ${entry.color}33)` }}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255,255,255,0.9)', 
                          borderRadius: '24px', 
                          border: 'none', 
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                          backdropFilter: 'blur(8px)',
                          padding: '12px 20px',
                          fontSize: '12px',
                          fontWeight: '800'
                        }}
                        itemStyle={{ color: '#1a1a1a' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-6">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex flex-col items-center p-3 rounded-2xl bg-muted/20 border border-muted/10 group-hover:bg-muted/30 transition-colors">
                      <div className="h-1.5 w-1.5 rounded-full mb-2" style={{ backgroundColor: item.color }} />
                      <span className="text-[9px] font-black uppercase text-muted-foreground/60">{item.name}</span>
                      <span className="text-sm font-black">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm italic border-2 border-dashed border-muted/30 rounded-3xl">
                Initialisation des données requise
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-4 glass-card border-none shadow-2xl overflow-hidden group">
          <CardHeader className="pb-0 pt-8 px-8 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black tracking-tight uppercase">Performance par Section</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 italic">Top 5 des groupes en volume de traitement</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-full bg-secondary/5 flex items-center justify-center text-secondary border border-secondary/10">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-8 pt-8 pb-10">
            {barData.length > 0 ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      width={80} 
                      style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'currentColor' }} 
                    />
                    <RechartsTooltip 
                      cursor={{fill: 'rgba(46, 125, 50, 0.03)'}}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: '800' }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="url(#barGradient)" 
                      radius={[0, 12, 12, 0]} 
                      barSize={32} 
                      animationDuration={2500}
                    />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#1565C0" />
                        <stop offset="100%" stopColor="#1565C0CC" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm italic border-2 border-dashed border-muted/30 rounded-3xl">
                Aucune corrélation de groupe détectée
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7 pb-10">
        {/* Quick Actions */}
        <Card className="col-span-3 glass-card border-none shadow-2xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-6 px-8">
            <CardTitle className="text-xl font-black tracking-tight uppercase">Actions Institutionnelles</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary/60 italic">Accès rapide aux services critiques</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            {quickActions.map((action, idx) => (
              <button
                key={action.title}
                onClick={() => navigate(action.path)}
                className="group w-full flex items-center gap-6 rounded-3xl border border-muted/20 bg-background/40 p-5 text-left transition-all hover:bg-white/80 hover:border-primary/40 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98]"
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white group-hover:rotate-6 transition-all duration-500 shadow-inner`}>
                  <action.icon className="h-7 w-7" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-black text-sm uppercase tracking-tight group-hover:text-primary transition-colors">{action.title}</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{action.description}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-muted/20 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-4 glass-card border-none shadow-2xl overflow-hidden">
          <CardHeader className="bg-secondary/5 border-b border-secondary/10 py-6 px-8 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black tracking-tight uppercase">Flux de Traitement</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-secondary/60 italic">Journal des dossiers récents</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/students")} className="rounded-full h-10 px-6 font-black text-[10px] uppercase tracking-widest border-secondary/20 text-secondary hover:bg-secondary hover:text-white transition-all shadow-lg">
              Archives Complètes
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-muted/10">
              {loading ? (
                <div className="p-8 space-y-6">
                  {[1,2,3,4].map(i => <div key={i} className="h-20 w-full animate-pulse bg-muted/40 rounded-3xl" />)}
                </div>
              ) : recentActivity.length > 0 ? (
                recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center justify-between p-6 px-8 hover:bg-primary/[0.02] transition-colors group cursor-pointer" onClick={() => navigate(`/students/${activity.cin}`)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-2xl bg-muted/30 flex flex-col items-center justify-center border border-muted/20 shadow-inner group-hover:bg-white transition-colors group-hover:scale-105 duration-500">
                          <span className="text-xs font-black text-primary">{activity.student.split(' ')[0][0]}</span>
                          <span className="text-[8px] font-black text-muted-foreground/40">{activity.student.split(' ')[1]?.[0]}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-black uppercase tracking-tight group-hover:text-primary transition-colors">{activity.student}</p>
                            {(students.find(s => s.cin === activity.cin) as any)?.verified_arabic_name && (
                              <Badge className="bg-secondary/10 text-secondary border-none px-3 py-0.5 rounded-full font-black text-[10px] font-arabic italic" dir="rtl">
                                {(students.find(s => s.cin === activity.cin) as any).verified_arabic_name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60 tracking-widest">{activity.cin}</span>
                            <span className="text-[10px] text-muted-foreground/30">•</span>
                            <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tighter">Instance: {activity.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge 
                        variant={activity.status === "verified" ? "success" : activity.status === "mismatch" ? "destructive" : "secondary"} 
                        className="rounded-full px-4 py-1.5 font-black text-[9px] tracking-[0.1em] shadow-lg shadow-black/5"
                      >
                        {activity.status === "verified" ? "CONFORME" : activity.status === "mismatch" ? "ANOMALIE" : "MISSING"}
                      </Badge>
                      <span className="text-[9px] font-black text-muted-foreground/30 uppercase">ID: {activity.cin.slice(-4)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-24 text-muted-foreground font-black text-xs uppercase tracking-[0.2em] italic opacity-20">
                  <FileX className="h-12 w-12 mx-auto mb-4 opacity-10" />
                  Flux de données inactif
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
