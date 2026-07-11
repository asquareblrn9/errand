<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DisputeEvidence extends Model
{
    use HasUuid;

    protected $table = 'dispute_evidence';

    protected $fillable = ['dispute_id', 'uploaded_by', 'type', 'path', 'url'];

    public function dispute(): BelongsTo { return $this->belongsTo(Dispute::class); }
}
