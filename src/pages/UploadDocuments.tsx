import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FolderOpen, CheckCircle2, AlertCircle } from "lucide-react";

interface DetectedFolder {
  filiere: string;
  classes: { classe: string; studentCount: number }[];
}

const UploadDocuments = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [folders, setFolders] = useState<DetectedFolder[]>([]);
  const [done, setDone] = useState(false);

  const handleFolderSelect = () => {
    // Simulate folder detection
    setFolders([
      {
        filiere: "Développement Digital",
        classes: [
          { classe: "DD201", studentCount: 12 },
          { classe: "DD202", studentCount: 8 },
        ],
      },
      {
        filiere: "Infrastructure Digitale",
        classes: [
          { classe: "ID101", studentCount: 15 },
          { classe: "ID102", studentCount: 10 },
        ],
      },
      {
        filiere: "Gestion des Entreprises",
        classes: [
          { classe: "GE301", studentCount: 9 },
          { classe: "GE302", studentCount: 11 },
        ],
      },
    ]);
    setDone(false);
    setProgress(0);
  };

  const handleUpload = () => {
    setUploading(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          setDone(true);
          return 100;
        }
        return prev + 5;
      });
    }, 300);
  };

  const totalStudents = folders.reduce((sum, f) => sum + f.classes.reduce((s, c) => s + c.studentCount, 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Student Documents</h1>
        <p className="text-muted-foreground">
          Upload a root folder containing: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Filière / Classe / Student Documents (images)</code>
        </p>
      </div>

      {/* Folder structure explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected Folder Structure</CardTitle>
          <CardDescription>Your folder should follow this hierarchy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-4 font-mono text-sm space-y-1">
            <p className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> 📁 Root Folder/</p>
            <p className="ml-6 flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> 📁 Développement Digital/</p>
            <p className="ml-12 flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> 📁 DD201/</p>
            <p className="ml-18 text-muted-foreground">🖼️ BK123456_birth.jpg</p>
            <p className="ml-18 text-muted-foreground">🖼️ BK123456_bac.jpg</p>
            <p className="ml-18 text-muted-foreground">🖼️ BK123456_cin.jpg</p>
            <p className="ml-12 flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> 📁 DD202/</p>
            <p className="ml-18 text-muted-foreground">🖼️ ...</p>
            <p className="ml-6 flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> 📁 Infrastructure Digitale/</p>
            <p className="ml-12 text-muted-foreground">...</p>
          </div>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-12">
            <Upload className="h-12 w-12 text-primary/60" />
            <p className="font-medium">Select the root folder containing all student documents</p>
            <p className="text-sm text-muted-foreground">The system will auto-detect filières, classes, and student files</p>
            <Button variant="outline" onClick={handleFolderSelect}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Select Folder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detected structure */}
      {folders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Detected Structure</span>
              <Badge variant="secondary">{totalStudents} students found</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {folders.map(f => (
              <div key={f.filiere} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{f.filiere}</span>
                </div>
                <div className="ml-6 flex flex-wrap gap-2">
                  {f.classes.map(c => (
                    <Badge key={c.classe} variant="outline" className="text-xs">
                      {c.classe} — {c.studentCount} students
                    </Badge>
                  ))}
                </div>
              </div>
            ))}

            {!done && (
              <div className="flex justify-end pt-2">
                <Button onClick={handleUpload} disabled={uploading}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process All ({totalStudents} students)
                </Button>
              </div>
            )}

            {(uploading || progress > 0) && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-3">
                  <Progress value={progress} className="flex-1" />
                  <span className="text-sm font-medium">{progress}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {progress < 100 ? "Uploading and processing documents with OCR..." : ""}
                </p>
              </div>
            )}

            {done && (
              <div className="flex items-center gap-3 rounded-lg bg-success/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="font-semibold text-sm">Upload Complete!</p>
                  <p className="text-xs text-muted-foreground">{totalStudents} student documents processed. Check the Mismatched and Verified pages for results.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UploadDocuments;
