<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'mismatch_details' => 'array',
        'document_paths' => 'array',
    ];

    /**
     * Find a student by either their database ID or their unique student_id.
     */
    public static function findByAnyId($id)
    {
        return static::where('id', $id)
            ->orWhere('student_id', $id)
            ->first();
    }
}
