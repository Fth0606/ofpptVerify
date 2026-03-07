import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiService, Student } from "@/lib/api-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, FileText, CreditCard, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

const statusBadge = (status: string) => {
  switch (status) {
    case "verified": return <Badge className="bg-success/15 text-success border-0">✅ Verified</Badge>;
    case "mismatch": return <Badge className="bg-warning/15 text-warning border-0">⚠️ Mismatch</Badge>;
    case "pending": return <Badge variant="secondary">⏳ Pending</Badge>;
    case "missing": return <Badge variant="destructive">❌ Missing</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
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
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudent = async () => {
    if (!id) return;
    try {
      const data = await apiService.fetchStudentById(id);
      setStudent(data);
    } catch (error) {
      toast.error("Student not found");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !uploadingType) return;

    try {
      toast.loading(`Uploading ${uploadingType}...`, { id: "upload" });
      await apiService.uploadDocument(id, uploadingType, file);
      toast.success("Document uploaded successfully", { id: "upload" });

      // Update local state or re-fetch to show "Uploaded"
      // Simplification: Increment counter for now as backend doesn't yet track per-type docs in DB
      if (student) {
        setStudent({
          ...student,
          documentsUploaded: Math.min(3, student.documentsUploaded + 1)
        });
      }

      // Clear selection
      e.target.value = "";
    } catch (error) {
      toast.error("Failed to upload document", { id: "upload" });
      console.error(error);
    } finally {
      setUploadingType(null);
    }
  };

  const triggerUpload = (type: string) => {
    setUploadingType(type);
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading student details...</p>
      </div>
    );
  }

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
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={onFileChange}
        accept=".pdf,.jpg,.jpeg,.png"
      />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/students")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {student.lastName && student.firstName
              ? `${student.lastName} ${student.firstName}`
              : student.fullName}
          </h1>
          <p className="text-muted-foreground">{student.filiere} · {student.classe} · {student.group}</p>
        </div>
        {statusBadge(student.status)}
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Personal Information (Excel Data)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Last Name (Nom)", student.lastName || "-"],
              ["First Name (Prénom)", student.firstName || "-"],
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
              const uploaded = student.document_paths && (student.document_paths as any)[doc.key];
              return (
                <div key={doc.key} className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${uploaded ? "border-success/30 bg-success/5" : "border-border"}`}>
                  <doc.icon className={`h-8 w-8 ${uploaded ? "text-success" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium">{doc.label}</p>
                  {uploaded ? (
                    <div className="flex flex-col items-center gap-2">
                      <Badge className="bg-success/15 text-success border-0">Uploaded</Badge>
                      {student.document_paths && (student.document_paths as any)[doc.key] && (
                        <a
                          href={`http://localhost:8000/storage/${(student.document_paths as any)[doc.key]}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          View Document
                        </a>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerUpload(doc.key)}
                      disabled={uploadingType !== null}
                    >
                      <Upload className="mr-2 h-3 w-3" />
                      Upload
                    </Button>
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
