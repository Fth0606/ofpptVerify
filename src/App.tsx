import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";

import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import StudentDetail from "@/pages/StudentDetail";
import ImportExcel from "@/pages/ImportExcel";
import UploadDocuments from "@/pages/UploadDocuments";
import MismatchedStudents from "@/pages/MismatchedStudents";
import CorrectStudents from "@/pages/CorrectStudents";
import NotFound from "@/pages/NotFound";

import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="ofppt-verify-theme">
    <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/import" element={<ImportExcel />} />
            <Route path="/upload" element={<UploadDocuments />} />
            <Route path="/mismatched" element={<MismatchedStudents />} />
            <Route path="/verified" element={<CorrectStudents />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
