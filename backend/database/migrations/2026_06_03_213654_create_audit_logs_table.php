<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the audit_logs table.
     *
     * Immutable log of all sensitive actions on the platform.
     * Used for:
     *  - Security incident investigation
     *  - Regulatory compliance (CBN, NDPR)
     *  - Debugging user-reported issues
     *  - Admin review of suspicious activity
     *
     * This table is append-only — rows are never updated or deleted
     * from application code. Retention policy: 2 years in hot storage,
     * then archived to S3/Glacier.
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('set null');
            $table->string('action', 100);
            $table->string('model_type', 100);
            $table->uuid('model_id')->nullable();
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->jsonb('metadata')->nullable()->default('{}');
            $table->timestamp('created_at')->useCurrent();

            // Composite indexes for common query patterns
            $table->index('user_id');
            $table->index('action');
            $table->index(['model_type', 'model_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
