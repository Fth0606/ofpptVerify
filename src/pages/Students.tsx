import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, ArrowUpDown, MoreHorizontal, User, Trash2, Eye } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
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
    return matchesSearch && matchesStatus;
  });

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
          <h1 className="text-2xl font-bold tracking-tight">Student Directory</h1>
          <p className="text-muted-foreground">Manage and monitor all student verification statuses</p>
        </div>
        <Button onClick={() => navigate("/import")}>Import New Students</Button>
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
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="mismatch">Mismatch</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="missing">Missing Docs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
                  <TableHead className="text-white font-bold uppercase py-4 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Loading students...</TableCell>
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
                        <TableCell className="text-center py-4" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 px-4 bg-red-600 hover:bg-red-700"
                            onClick={() => {
                              setStudentToDelete(student);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No students found matching your criteria
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
