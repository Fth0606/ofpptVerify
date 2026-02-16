import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockStudents } from "@/lib/mock-data";
import { Search } from "lucide-react";

const statusBadge = (status: string) => {
  switch (status) {
    case "verified": return <Badge className="bg-success/15 text-success border-0">Verified</Badge>;
    case "mismatch": return <Badge className="bg-warning/15 text-warning border-0">Mismatch</Badge>;
    case "pending": return <Badge variant="secondary">Pending</Badge>;
    case "missing": return <Badge variant="destructive">Missing</Badge>;
    default: return null;
  }
};

const Students = () => {
  const [search, setSearch] = useState("");
  const [filterFiliere, setFilterFiliere] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const navigate = useNavigate();

  const filieres = [...new Set(mockStudents.map(s => s.filiere))];

  const filtered = mockStudents.filter(s => {
    const matchSearch = s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.cin.toLowerCase().includes(search.toLowerCase());
    const matchFiliere = filterFiliere === "all" || s.filiere === filterFiliere;
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchFiliere && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage and verify student records</p>
        </div>
        <Button onClick={() => navigate("/import")}>Import from Excel</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or CIN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterFiliere} onValueChange={setFilterFiliere}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Filières</SelectItem>
              {filieres.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="mismatch">Mismatch</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>CIN</TableHead>
                <TableHead>Filière</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                  <TableCell className="font-medium">{s.fullName}</TableCell>
                  <TableCell>{s.cin}</TableCell>
                  <TableCell>{s.filiere}</TableCell>
                  <TableCell>{s.classe} - {s.group}</TableCell>
                  <TableCell>{s.documentsUploaded}/3</TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No students found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Students;
