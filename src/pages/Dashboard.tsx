import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { dashboardStats, mockStudents } from "@/lib/mock-data";
import { Users, CheckCircle2, AlertTriangle, Clock, FileX2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const statCards = [
  { label: "Total Students", value: dashboardStats.total, icon: Users, color: "text-primary" },
  { label: "Verified", value: dashboardStats.verified, icon: CheckCircle2, color: "text-success" },
  { label: "Mismatches", value: dashboardStats.mismatches, icon: AlertTriangle, color: "text-warning" },
  { label: "Pending", value: dashboardStats.pending, icon: Clock, color: "text-muted-foreground" },
  { label: "Missing Docs", value: dashboardStats.missing, icon: FileX2, color: "text-destructive" },
];

const statusBadge = (status: string) => {
  switch (status) {
    case "verified": return <Badge className="bg-success/15 text-success border-0">✅ Verified</Badge>;
    case "mismatch": return <Badge className="bg-warning/15 text-warning border-0">⚠️ Mismatch</Badge>;
    case "pending": return <Badge variant="secondary">⏳ Pending</Badge>;
    case "missing": return <Badge variant="destructive">❌ Missing</Badge>;
    default: return null;
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const verifiedPercent = Math.round((dashboardStats.verified / dashboardStats.total) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of student document verification progress</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={verifiedPercent} className="flex-1" />
            <span className="text-sm font-semibold">{verifiedPercent}%</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {dashboardStats.verified} of {dashboardStats.total} students fully verified
          </p>
        </CardContent>
      </Card>

      {/* Recent Students */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockStudents.slice(0, 5).map((student) => (
              <div
                key={student.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                onClick={() => navigate(`/students/${student.id}`)}
              >
                <div>
                  <p className="font-medium">{student.fullName}</p>
                  <p className="text-xs text-muted-foreground">{student.filiere} · {student.classe}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{student.documentsUploaded}/3 docs</span>
                  {statusBadge(student.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
