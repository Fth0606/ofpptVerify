import { useParams, useNavigate } from "react-router-dom";
import { mockStudents } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, FileText, CreditCard, GraduationCap } from "lucide-react";

const statusBadge = (status: string) => {
  switch (status) {
    case "verified": return <Badge className="bg-success/15 text-success border-0">✅ Verified</Badge>;
    case "mismatch": return <Badge className="bg-warning/15 text-warning border-0">⚠️ Mismatch</Badge>;
    case "pending": return <Badge variant="secondary">⏳ Pending</Badge>;
    case "missing": return <Badge variant="destructive">❌ Missing</Badge>;
    default: return null;
  }
};

const docTypes = [
  { key: "birth_certificate", label: "Birth Certificate", icon: FileText },
  { key: "baccalaureate", label: "Baccalaureate", icon: GraduationCap },
  { key: "cin", label: "CIN (ID Card)", icon: CreditCard },
];

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const student = mockStudents.find(s => s.id === id);

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Student not found</p>
        <Button variant="ghost" onClick={() => navigate("/students")} className="mt-4">Back to Students</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/students")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{student.fullName}</h1>
          <p className="text-muted-foreground">{student.filiere} · {student.classe} · Group {student.group}</p>
        </div>
        {statusBadge(student.status)}
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Personal Information (Excel Data)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Full Name", student.fullName],
              ["Date of Birth", student.dateOfBirth],
              ["Birthplace", student.birthplace],
              ["CIN", student.cin],
              ["Parent Name", student.parentName],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Academic Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Filière", student.filiere],
              ["Classe", student.classe],
              ["Group", student.group],
              ["Bac Year", student.bacYear],
              ["Bac Score", student.bacScore],
              ["Bac Mention", student.bacMention],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {docTypes.map((doc) => {
              const uploaded = student.documentsUploaded > docTypes.indexOf(doc);
              return (
                <div key={doc.key} className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${uploaded ? "border-success/30 bg-success/5" : "border-border"}`}>
                  <doc.icon className={`h-8 w-8 ${uploaded ? "text-success" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium">{doc.label}</p>
                  {uploaded ? (
                    <Badge className="bg-success/15 text-success border-0">Uploaded</Badge>
                  ) : (
                    <Button variant="outline" size="sm"><Upload className="mr-2 h-3 w-3" />Upload</Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDetail;
