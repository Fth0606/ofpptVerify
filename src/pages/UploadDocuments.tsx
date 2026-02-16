import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { mockStudents } from "@/lib/mock-data";
import { Upload, FileImage, User } from "lucide-react";

const UploadDocuments = () => {
  const [selectedStudent, setSelectedStudent] = useState("");
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const handleBulkUpload = () => {
    setUploadingBulk(true);
    setBulkProgress(0);
    const interval = setInterval(() => {
      setBulkProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setUploadingBulk(false); return 100; }
        return prev + 10;
      });
    }, 400);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Documents</h1>
        <p className="text-muted-foreground">Upload identity documents for OCR verification</p>
      </div>

      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual"><User className="mr-2 h-4 w-4" />Per Student</TabsTrigger>
          <TabsTrigger value="bulk"><Upload className="mr-2 h-4 w-4" />Bulk Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Student</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="Choose a student..." /></SelectTrigger>
                <SelectContent>
                  {mockStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.fullName} — {s.cin}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedStudent && (
            <div className="grid gap-4 md:grid-cols-3">
              {["Birth Certificate", "Baccalaureate", "CIN (ID Card)"].map((docLabel) => (
                <Card key={docLabel}>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40">
                      <FileImage className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm font-medium">{docLabel}</p>
                      <label>
                        <input type="file" accept="image/*" className="hidden" />
                        <Button variant="outline" size="sm" asChild><span>Choose File</span></Button>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bulk Document Upload</CardTitle>
              <CardDescription>Upload multiple documents at once. Name files with the student's CIN for automatic grouping (e.g., BK123456_birth.jpg)</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-12"
              >
                <Upload className="h-12 w-12 text-primary/60" />
                <p className="font-medium">Drag & drop multiple documents</p>
                <p className="text-sm text-muted-foreground">Supports JPG, PNG, PDF</p>
                <label>
                  <input type="file" multiple accept="image/*,.pdf" className="hidden" />
                  <Button variant="outline" asChild><span>Browse Files</span></Button>
                </label>
              </div>

              {!uploadingBulk && bulkProgress === 0 && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleBulkUpload}>Start Upload & OCR Processing</Button>
                </div>
              )}

              {(uploadingBulk || bulkProgress > 0) && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <Progress value={bulkProgress} className="flex-1" />
                    <span className="text-sm font-medium">{bulkProgress}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bulkProgress < 100 ? "Processing documents with OCR..." : "All documents processed!"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UploadDocuments;
