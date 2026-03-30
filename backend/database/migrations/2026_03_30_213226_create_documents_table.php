<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->enum('type', ['cin', 'baccalaureate', 'birth_certificate', 'other'])->default('other');
            $table->string('original_filename');
            $table->string('mime_type')->default('image/jpeg');
            $table->integer('file_size')->default(0); // in bytes
            $table->longText('file_data'); // base64-encoded binary content
            $table->string('ocr_extracted_name')->nullable();
            $table->string('ocr_extracted_dob')->nullable();
            $table->string('ocr_extracted_cin')->nullable();
            $table->enum('ocr_status', ['pending', 'processed', 'failed'])->default('pending');
            $table->timestamps();

            $table->foreign('student_id')
                  ->references('id')
                  ->on('students')
                  ->onDelete('cascade');

            $table->index('student_id');
            $table->index('type');
        });

        // Remove old document_paths column from students
        if (Schema::hasColumn('students', 'document_paths')) {
            Schema::table('students', function (Blueprint $table) {
                $table->dropColumn('document_paths');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');

        // Restore old column
        Schema::table('students', function (Blueprint $table) {
            $table->json('document_paths')->nullable();
        });
    }
};
