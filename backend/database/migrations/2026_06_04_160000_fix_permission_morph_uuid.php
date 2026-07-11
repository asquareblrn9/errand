<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fix Spatie permission pivot tables to support UUID model IDs.
     *
     * The users table uses UUID primary keys, but the default Spatie
     * migration creates model_id as unsignedBigInteger. This migration
     * changes those columns to UUID type to match.
     */
    public function up(): void
    {
        // ── model_has_permissions ────────────────────────────
        Schema::table('model_has_permissions', function (Blueprint $table): void {
            // Drop the existing foreign key if it exists
            $table->dropForeign(['permission_id']);
        });

        // Alter the model_id column: bigint → uuid
        DB::statement('ALTER TABLE model_has_permissions ALTER COLUMN model_id TYPE UUID USING model_id::text::uuid');

        Schema::table('model_has_permissions', function (Blueprint $table): void {
            $table->foreign('permission_id')
                ->references('id')
                ->on('permissions')
                ->cascadeOnDelete();
        });

        // ── model_has_roles ──────────────────────────────────
        Schema::table('model_has_roles', function (Blueprint $table): void {
            $table->dropForeign(['role_id']);
        });

        DB::statement('ALTER TABLE model_has_roles ALTER COLUMN model_id TYPE UUID USING model_id::text::uuid');

        Schema::table('model_has_roles', function (Blueprint $table): void {
            $table->foreign('role_id')
                ->references('id')
                ->on('roles')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        // model_has_permissions
        Schema::table('model_has_permissions', function (Blueprint $table): void {
            $table->dropForeign(['permission_id']);
        });

        DB::statement('ALTER TABLE model_has_permissions ALTER COLUMN model_id TYPE BIGINT USING model_id::text::bigint');

        Schema::table('model_has_permissions', function (Blueprint $table): void {
            $table->foreign('permission_id')
                ->references('id')
                ->on('permissions')
                ->cascadeOnDelete();
        });

        // model_has_roles
        Schema::table('model_has_roles', function (Blueprint $table): void {
            $table->dropForeign(['role_id']);
        });

        DB::statement('ALTER TABLE model_has_roles ALTER COLUMN model_id TYPE BIGINT USING model_id::text::bigint');

        Schema::table('model_has_roles', function (Blueprint $table): void {
            $table->foreign('role_id')
                ->references('id')
                ->on('roles')
                ->cascadeOnDelete();
        });
    }
};
