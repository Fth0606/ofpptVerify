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
        Schema::table('students', function (Blueprint $table) {
            $table->string('firstName')->nullable()->after('student_id');
            $table->string('lastName')->nullable()->after('firstName');
        });

        // Data migration: Split existing fullName into firstName and lastName
        $students = DB::table('students')->get();
        foreach ($students as $student) {
            $parts = explode(' ', $student->fullName, 2);
            $lastName = $parts[0] ?? '';
            $firstName = $parts[1] ?? '';
            
            DB::table('students')->where('id', $student->id)->update([
                'firstName' => $firstName,
                'lastName' => $lastName,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn(['firstName', 'lastName']);
        });
    }
};
