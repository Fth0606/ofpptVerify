<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $hidden = ['file_data']; // Never return raw base64 in list responses

    /**
     * Relationship: document belongs to a student.
     */
    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * Get the document as a data URI (for embedding in HTML/API responses).
     */
    public function getDataUriAttribute(): string
    {
        return "data:{$this->mime_type};base64,{$this->file_data}";
    }

    /**
     * Detect document type from the original filename.
     */
    public static function detectType(string $filename): string
    {
        $lower = strtolower($filename);
        if (str_contains($lower, 'cin') || str_contains($lower, 'id') || str_contains($lower, 'carte')) {
            return 'cin';
        }
        if (str_contains($lower, 'bac')) {
            return 'baccalaureate';
        }
        if (str_contains($lower, 'naiss') || str_contains($lower, 'birth') || str_contains($lower, 'naissance')) {
            return 'birth_certificate';
        }
        return 'other';
    }
}
