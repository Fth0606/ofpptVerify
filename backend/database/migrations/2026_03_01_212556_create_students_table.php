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
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('student_id')->unique();
            $table->string('fullName');
            $table->string('dateOfBirth')->nullable();
            $table->string('birthplace')->nullable();
            $table->string('cin')->nullable();
            $table->string('filiere')->nullable();
            $table->string('classe')->nullable();
            $table->string('group')->nullable();
            $table->string('status')->default('pending');
            $table->integer('documentsUploaded')->default(0);
            $table->string('parentName')->nullable();
            $table->string('bacYear')->nullable();
            $table->string('bacScore')->nullable();
            $table->string('bacMention')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
