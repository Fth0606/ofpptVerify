import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, ArrowUpDown, MoreHorizontal, User, Trash2, Eye, CheckCircle2, AlertCircle, FileWarning, XCircle, ShieldCheck, FileCheck, FileX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiService, Student } from "@/lib/api-service";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await apiService.fetchStudents();
      setStudents(data);
    } catch (error) {
      toast.error("Failed to load students from database");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDelete = async () => {
    if (!studentToDelete) return;

    try {
      await apiService.deleteStudent(studentToDelete.id);
      toast.success(`Student ${studentToDelete.fullName} deleted successfully`);
      setStudents(students.filter(s => s.id !== studentToDelete.id));
    } catch (error) {
      toast.error("Failed to delete student");
      console.error(error);
    } finally {
      setStudentToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesGroup = groupFilter === "all" || s.group === groupFilter;
    return matchesSearch && matchesStatus && matchesGroup;
  });

  const uniqueGroups = Array.from(new Set(students.map(s => s.group).filter(Boolean))).sort();

  const handleVerifyGroup = async () => {
    if (groupFilter === "all") {
      toast.error("Please select a group first");
      return;
    }

    // Check if any student in the filtered group has documents
    const groupStudents = students.filter(s => s.group === groupFilter);
    const withDocs = groupStudents.filter(s => (s.documentsUploaded ?? 0) > 0 || (s as any).documents_count > 0);
    if (withDocs.length === 0) {
      toast.warning(`No documents uploaded for group ${groupFilter} yet. Please upload documents first via "Upload Documents".`);
      return;
    }

    setIsVerifying(true);
    const toastId = toast.loading(`Verifying group ${groupFilter}... This may take a minute.`);
    
    try {
      const response = await apiService.verifyGroup(groupFilter);
      setResults(response);
      toast.success(`Verification for group ${groupFilter} completed! ${response.length} students processed.`, { id: toastId });
      fetchStudents(); // Refresh data
    } catch (error: any) {
      const msg = error.message || "Verification failed";
      if (msg.includes("No documents")) {
        toast.warning(`No documents uploaded for this group yet. Upload documents first.`, { id: toastId });
      } else {
        toast.error(`Verification failed: ${msg}`, { id: toastId });
      }
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified": return <Badge variant="success">Verified</Badge>;
      case "mismatch": return <Badge variant="destructive">Mismatch</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "missing": return <Badge variant="outline">Missing Docs</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verification Panel</h1>
          <p className="text-muted-foreground">Select a group below and click "Verify Group" to match student documents with database records.</p>
        </div>
        <Button onClick={() => navigate("/import")} variant="outline">Import Student List</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or CIN..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="mismatch">Mismatch</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="missing">Missing Docs</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {uniqueGroups.map(group => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {groupFilter !== "all" && (
                <Button 
                  onClick={handleVerifyGroup} 
                  disabled={isVerifying}
                  className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                >
                  {isVerifying ? "Verifying..." : `Start Verification for ${groupFilter}`}
                </Button>
              )}
            </div>
          </div>
          {groupFilter !== "all" && !isVerifying && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
              <strong>Tip:</strong> Clicking "Start Verification" will process all students in <strong>{groupFilter}</strong> who have uploaded documents.
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-800 hover:bg-slate-800">
                <TableRow className="hover:bg-transparent border-b-0">
                  <TableHead className="text-white font-bold uppercase py-4">CIN <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead className="text-white font-bold uppercase py-4">Nom <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead className="text-white font-bold uppercase py-4">Prénom <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead className="text-white font-bold uppercase py-4">Filière <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead className="text-white font-bold uppercase py-4">Classe <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead className="text-white font-bold uppercase py-4">Age <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead className="text-white font-bold uppercase py-4 text-center">Docs</TableHead>
                  <TableHead className="text-white font-bold uppercase py-4 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Loading students...</TableCell>
                  </TableRow>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const calculateAge = (dob: string) => {
                      if (!dob) return "-";
                      try {
                        const birthDate = new Date(dob);
                        if (isNaN(birthDate.getTime())) return "-";
                        const today = new Date();
                        let age = today.getFullYear() - birthDate.getFullYear();
                        const m = today.getMonth() - birthDate.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                          age--;
                        }
                        return age;
                      } catch {
                        return "-";
                      }
                    };

                    return (
                      <TableRow
                        key={student.id}
                        className="cursor-pointer hover:bg-muted/50 border-b transition-colors"
                        onClick={() => navigate(`/students/${student.id}`)}
                      >
                        <TableCell className="font-mono text-sm py-4">{student.cin}</TableCell>
                        <TableCell className="font-medium py-4 uppercase">{student.lastName || "-"}</TableCell>
                        <TableCell className="font-medium py-4 capitalize">{student.firstName || "-"}</TableCell>
                        <TableCell className="py-4">{student.filiere || "-"}</TableCell>
                        <TableCell className="py-4 font-mono text-sm">{student.classe || "-"}</TableCell>
                        <TableCell className="py-4">{calculateAge(student.dateOfBirth)}</TableCell>
                        <TableCell className="text-center py-4">
                          {(() => {
                            // documents_count is returned by withCount('documents') on the backend
                            const actualCount = (student as any).documents_count ?? student.documentsUploaded ?? 0;
                            if (actualCount >= 3) {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                                  <FileCheck className="h-3 w-3" />
                                  {actualCount}/3
                                </span>
                              );
                            } else if (actualCount > 0) {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                  <FileCheck className="h-3 w-3" />
                                  {actualCount}/3
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
                                  <FileX className="h-3 w-3" />
                                  0/3
                                </span>
                              );
                            }
                          })()}
                        </TableCell>
                        <TableCell className="text-center py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-400"
                              onClick={() => navigate(`/students/${student.id}`)}
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              Show
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 px-3 bg-red-600 hover:bg-red-700"
                              onClick={() => {
                                setStudentToDelete(student);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No students found matching your criteria
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {results.length > 0 && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="bg-primary/5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                Latest Verification Results: {groupFilter}
              </CardTitle>
              <CardDescription>Detailed results for {results.length} students</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setResults([])}>
              <XCircle className="mr-2 h-4 w-4" /> Clear Results
            </Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {results.map((res, idx) => {
                const student = students.find(s => s.cin === res.cin);
                // Use student database status as source of truth if available
                const isCorrect = student ? student.status === "verified" : res.is_correct;
                const dbMismatches = student?.mismatch_details || [];
                
                return (
                  <div key={idx} className={`rounded-xl border-2 p-5 ${isCorrect ? "bg-green-50/30 border-green-100" : "bg-red-50/30 border-red-100"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isCorrect ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                          {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-lg leading-none mb-1">CIN: {res.cin}</p>
                          <p className="text-sm text-muted-foreground">{res.folder}</p>
                        </div>
                      </div>
                      <Badge variant={isCorrect ? "success" : "destructive"} className="px-3 py-1">
                        {isCorrect ? "MATCHED" : "MISMATCH"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Extracted from Docs:</p>
                        <p className={`font-semibold ${isCorrect ? "text-green-700" : "text-amber-700"}`}>
                          {res.verified_name || "Name extraction failed"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Database Record:</p>
                        <p className="font-semibold text-blue-700">{student?.fullName || "Not found in DB"}</p>
                      </div>
                    </div>

                    {!isCorrect && (
                      <div className="mb-4 p-4 rounded-lg bg-red-100/50 border border-red-200">
                        <p className="text-xs font-bold text-red-800 mb-2 flex items-center gap-2">
                          <AlertCircle className="h-3 w-3" /> Mismatch / Error Details:
                        </p>
                        <ul className="space-y-1">
                          {/* Prefer DB mismatches if available, fallback to OCR errors */}
                          {dbMismatches.length > 0 ? (
                            dbMismatches.map((m: any, i: number) => (
                              <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                                <span className="shrink-0">•</span>
                                <span>
                                  <strong>{m.field}</strong> ({m.document}): 
                                  Expected "{m.excelValue}", Got "{m.ocrValue}"
                                </span>
                              </li>
                            ))
                          ) : (
                            res.errors && res.errors.map((err: any, i: number) => (
                              <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                                <span className="shrink-0">•</span>
                                <span><strong>{err.file}</strong>: {err.error}</span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Document Extractions:</p>
                      <div className="flex flex-wrap gap-3">
                        {res.file_details && res.file_details.map((detail: any, i: number) => (
                          <div key={i} className="flex-1 min-w-[200px] p-3 rounded-lg bg-white/50 border border-gray-100">
                            <p className="text-[10px] font-bold truncate mb-1" title={detail.file}>{detail.file}</p>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground truncate">
                                {detail.extracted_name || "No name found"}
                              </span>
                              {detail.extracted_dob && (
                                <Badge variant="outline" className="text-[10px] font-normal py-0">
                                  {detail.extracted_dob}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
            })}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete <strong>{studentToDelete?.fullName}</strong> from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Students;
