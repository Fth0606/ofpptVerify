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
    { name: "Vérifiés", value: stats.verified, color: "hsl(150, 100%, 27%)" },
    { name: "Non Concordants", value: stats.mismatches, color: "hsl(0, 84.2%, 60.2%)" },
    { name: "Docs Manquants", value: stats.missing, color: "hsl(38, 92%, 50%)" },
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de Bord</h1>
          <p className="text-muted-foreground">Suivre l'avancement de la vérification et les activités récentes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-gray-400" onClick={() => navigate("/students")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des Étudiants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.total}</div>
            <p className="text-xs text-muted-foreground">Dans le système</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-success" onClick={() => navigate("/verified")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vérifiés</CardTitle>
            <FileCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{loading ? "..." : stats.verified}</div>
            <p className="text-xs text-muted-foreground">Prêts pour l'export</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-destructive" onClick={() => navigate("/mismatched")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Non Concordants</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{loading ? "..." : stats.mismatches}</div>
            <p className="text-xs text-muted-foreground">Nécessite une attention</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-warning" onClick={() => navigate("/students")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Docs Manquants</CardTitle>
            <FileX className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{loading ? "..." : stats.missing}</div>
            <p className="text-xs text-muted-foreground">En attente de téléversement</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Répartition des Statuts</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-0">
            {stats.total > 0 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top Groupes par Étudiants</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <div className="h-[200px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} style={{ fontSize: '10px' }} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="count" fill="hsl(211, 100%, 31%)" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Quick Actions */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Actions Rapides</CardTitle>
            <CardDescription>Tâches courantes pour gérer le système</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {quickActions.map((action) => (
              <button
                key={action.title}
                onClick={() => navigate(action.path)}
                className="flex items-center gap-4 rounded-xl border p-3 text-left transition-all hover:bg-muted hover:shadow-sm"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${action.color}`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-semibold text-sm">{action.title}</h3>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Étudiants Récents</CardTitle>
              <CardDescription>Mises à jour récentes</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/students")}>
              Voir Tout <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Chargement des activités...</div>
              ) : recentActivity.length > 0 ? (
                recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{activity.student}</p>
                        {(students.find(s => s.cin === activity.cin) as any)?.verified_arabic_name && (
                          <span className="text-xs text-success/70 font-medium" dir="rtl">
                            {(students.find(s => s.cin === activity.cin) as any).verified_arabic_name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{activity.cin} — {activity.time}</p>
                    </div>
                    <Badge variant={activity.status === "verified" ? "success" : activity.status === "mismatch" ? "destructive" : "secondary"} className="shrink-0 ml-2">
                      {activity.status === "verified" ? "Vérifié" : activity.status === "mismatch" ? "Non Concordant" : activity.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">Aucune activité récente</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
