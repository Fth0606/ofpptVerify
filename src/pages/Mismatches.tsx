import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { mockMismatches, type StudentMismatch } from "@/lib/mock-data";
import { AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react";

const docLabel = (doc: string) => {
  switch (doc) {
    case "birth_certificate": return "Birth Certificate";
    case "baccalaureate": return "Baccalaureate";
    case "cin": return "CIN";
    default: return doc;
  }
};

const Mismatches = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const handleResolve = (id: string) => {
    setResolved(prev => new Set(prev).add(id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mismatch Review</h1>
        <p className="text-muted-foreground">Review and resolve detected discrepancies</p>
      </div>

      {mockMismatches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Check className="h-10 w-10 text-success" />
            <p className="font-medium">No mismatches found</p>
            <p className="text-sm text-muted-foreground">All student data matches their documents</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mockMismatches.map((mm) => {
            const isExpanded = expandedId === mm.student.id;
            const isResolved = resolved.has(mm.student.id);

            return (
              <Card key={mm.student.id} className={isResolved ? "opacity-60" : ""}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : mm.student.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      <div>
                        <CardTitle className="text-base">{mm.student.fullName}</CardTitle>
                        <p className="text-xs text-muted-foreground">{mm.student.cin} · {mm.student.filiere}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-warning/15 text-warning border-0">
                        {mm.mismatches.length} mismatch{mm.mismatches.length > 1 ? "es" : ""}
                      </Badge>
                      {isResolved && <Badge className="bg-success/15 text-success border-0">Resolved</Badge>}
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4">
                    {/* Mismatch fields */}
                    <div className="space-y-3">
                      {mm.mismatches.map((m, i) => (
                        <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-destructive">{m.field}</span>
                            <Badge variant="outline" className="text-xs">{docLabel(m.document)}</Badge>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Excel Value</p>
                              <Input defaultValue={m.excelValue} className="text-sm" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">OCR Extracted</p>
                              <Input defaultValue={m.ocrValue} disabled className="text-sm bg-muted" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    <div>
                      <p className="text-sm font-medium mb-2">Admin Notes</p>
                      <Textarea placeholder="Add notes about this discrepancy..." />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline">Save Changes</Button>
                      <Button onClick={() => handleResolve(mm.student.id)} disabled={isResolved}>
                        <Check className="mr-2 h-4 w-4" />Mark as Resolved
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Mismatches;
