import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileCheck, AlertCircle, FileX, ArrowRight, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiService, Student } from "@/lib/api-service";
import { toast } from "sonner";

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
    student: s.fullName,
    cin: s.cin,
    status: s.status,
    time: "Last update",
  }));

  const quickActions = [
    { title: "Import Students", description: "Upload .xlsx file", icon: Users, path: "/import", color: "bg-blue-100 text-blue-600" },
    { title: "Upload Documents", description: "Process images with OCR", icon: Upload, path: "/upload", color: "bg-purple-100 text-purple-600" },
    { title: "Review Mismatches", description: "Fix OCR discrepancies", icon: AlertCircle, path: "/mismatched", color: "bg-red-100 text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Dashboard</h1>
          <p className="text-muted-foreground">Monitor verification progress and recent activities</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/students")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.total}</div>
            <p className="text-xs text-muted-foreground">In the system</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/correct")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <FileCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{loading ? "..." : stats.verified}</div>
            <p className="text-xs text-muted-foreground">Ready for export</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/mismatched")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mismatches</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{loading ? "..." : stats.mismatches}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/students")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missing Docs</CardTitle>
            <FileX className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{loading ? "..." : stats.missing}</div>
            <p className="text-xs text-muted-foreground">Awaiting upload</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Quick Actions */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            <CardDescription>Common tasks to manage the system</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {quickActions.map((action) => (
              <button
                key={action.title}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-3 rounded-xl border p-4 text-center transition-all hover:bg-muted hover:shadow-sm"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${action.color}`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{action.title}</h3>
                  <p className="text-xs text-muted-foreground leading-tight">{action.description}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Recent Students</CardTitle>
              <CardDescription>Most recent student updates</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/students")}>
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading recent activity...</div>
              ) : recentActivity.length > 0 ? (
                recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{activity.student}</p>
                      <p className="text-xs text-muted-foreground">{activity.cin} — {activity.time}</p>
                    </div>
                    <Badge variant={activity.status === "verified" ? "success" : activity.status === "mismatch" ? "destructive" : "secondary"}>
                      {activity.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
