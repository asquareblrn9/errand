<?php

declare(strict_types=1);

namespace App\Models;

use App\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\RequestPhoto
 *
 * @property string $id
 * @property string $request_id
 * @property string $path      S3 object key
 * @property string $url       Public CDN URL
 * @property int    $sort_order
 *
 * @property-read Request $request
 */
class RequestPhoto extends Model
{
    use HasUuid;

    protected $table = 'request_photos';

    protected $fillable = [
        'request_id', 'path', 'url', 'sort_order',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(Request::class);
    }
}
