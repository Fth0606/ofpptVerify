
# OFPPT Student Document Verification System

## Overview
An admin web application for OFPPT establishments that automates student document verification using AI-powered OCR. Admins import student data from Excel, upload identity documents (birth certificate, baccalaureate, CIN), and the system automatically extracts and cross-checks information, flagging any mismatches for manual review.

---

## Pages & Features

### 1. Authentication (Login Page)
- Email/password login for multiple admins
- Protected routes — only authenticated admins can access the dashboard

### 2. Dashboard (Home)
- Summary statistics: total students, verified, pending, mismatches found
- Quick access to recent uploads and pending reviews
- Visual indicators showing verification progress

### 3. Student Data Import (Excel)
- Upload Excel files (.xlsx/.csv) containing student records (name, date of birth, CIN, filière, classe, group, etc.)
- Preview imported data in a table before confirming
- Ability to re-import or update existing records

### 4. Document Upload & OCR Processing
- **Per-student upload**: Select a student and upload their 3 documents (birth certificate, baccalaureate, ID card)
- **Bulk upload**: Upload multiple documents at once; the system groups them by student
- AI-powered OCR extracts key fields: full name, date of birth, birthplace, CIN number, baccalaureate details (score, mention, year), parents' names
- Progress indicators during OCR processing

### 5. Verification & Matching
- Automatic comparison between OCR-extracted data and imported Excel data
- Fields checked: name consistency across all 3 documents, DOB match, CIN match, baccalaureate info
- Status per student: ✅ Verified, ⚠️ Mismatch, ❌ Missing documents

### 6. Mismatch Review Page
- List of all students with detected issues
- Side-by-side view: extracted document data vs. Excel data
- Highlight the specific mismatching fields in red
- Admin can manually correct values and mark as resolved
- Option to add notes explaining discrepancies

### 7. Student List & Search
- Searchable, filterable table of all students
- Filter by: filière, classe, verification status
- Click on any student to see their full profile and documents

### 8. Student Profile Detail
- View all 3 uploaded documents (zoomable image viewer)
- See extracted OCR data alongside the imported Excel data
- Verification status and history of corrections

---

## Backend (Lovable Cloud + Supabase)
- **Database**: Students table, documents table, verification results, admin accounts
- **Storage**: Supabase Storage for uploaded document images
- **OCR**: AI-powered text extraction using Lovable AI (Gemini vision model) to read document images and extract structured data
- **Authentication**: Supabase Auth for admin login

---

## Design
- Clean, professional admin interface
- English language
- Responsive layout (primarily desktop-focused for admin work)
- Color-coded status indicators for quick scanning
