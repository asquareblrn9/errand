<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\RequestStatus;
use App\Events\RequestPosted;
use App\Models\Category;
use App\Models\Request;
use App\Models\RequestPhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;

class RequestService
{
    public function __construct(
        private readonly FileUploadService $fileUpload,
    ) {}

    /**
     * Create a new request with optional photos.
     *
     * @param  array{title: string, description: string, category_id: string, location: string, latitude: float, longitude: float, budget_hint?: float, is_urgent?: bool, company_id?: string}  $data
     * @param  array<int, UploadedFile>  $photos
     */
    public function create(User $requester, array $data, array $photos = []): Request
    {
        $category = Category::findOrFail($data['category_id']);
        $urgentFee = 0;

        if (! empty($data['is_urgent'])) {
            $urgentFee = (float) config('errandboy.urgent_request_fee', 1500);
        }

        /** @var Request $request */
        $request = Request::create([
            'user_id' => $requester->id,
            'category_id' => $category->id,
            'company_id' => $data['company_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'],
            'location' => $data['location'],
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'budget_hint' => $data['budget_hint'] ?? null,
            'status' => RequestStatus::Open,
            'is_urgent' => ! empty($data['is_urgent']),
            'sla_minutes' => $data['sla_minutes'] ?? null,
            'urgent_fee' => $urgentFee,
        ]);

        // Upload photos
        foreach ($photos as $index => $file) {
            $result = $this->fileUpload->uploadRequestPhoto($file, $request->id, $index);
            RequestPhoto::create([
                'request_id' => $request->id,
                'path' => $result['path'],
                'url' => $result['url'],
                'sort_order' => $index,
            ]);
        }

        // Dispatch event to notify erranders
        event(new RequestPosted($request));

        return $request->fresh()->load('photos', 'category', 'requester');
    }

    /**
     * Update an existing request.
     */
    public function update(Request $request, array $data): Request
    {
        $request->update($data);

        return $request->fresh();
    }

    /**
     * Cancel a request.
     */
    public function cancel(Request $request, ?string $reason = null): void
    {
        $request->markCancelled($reason);
    }

    /**
     * Get the errander feed — open requests sorted by urgency and recency.
     */
    public function feed(array $filters = [], int $perPage = 20): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $query = Request::with(['category', 'requester', 'photos'])
            ->where('status', RequestStatus::Open);

        // Category filter
        if (! empty($filters['category_id'])) {
            $query->byCategory($filters['category_id']);
        }

        // Urgent only
        if (! empty($filters['urgent_only'])) {
            $query->urgent();
        }

        // Location-based (nearby)
        if (! empty($filters['latitude']) && ! empty($filters['longitude'])) {
            $radius = (int) ($filters['radius_km'] ?? 10);
            $query->nearby(
                (float) $filters['latitude'],
                (float) $filters['longitude'],
                $radius
            );

            // Nearby scope orders by distance; drop that ordering for other sorts
            if (($filters['sort'] ?? 'newest') !== 'distance') {
                $query->reorder();
            }
        }

        // Budget range
        if (! empty($filters['budget_min'])) {
            $query->where('budget_hint', '>=', (float) $filters['budget_min']);
        }
        if (! empty($filters['budget_max'])) {
            $query->where('budget_hint', '<=', (float) $filters['budget_max']);
        }

        // Urgent first, then requested sort order
        $query->orderByDesc('is_urgent');

        switch ($filters['sort'] ?? 'newest') {
            case 'distance':
                // Nearby scope already orders by distance when coordinates exist
                if (empty($filters['latitude']) || empty($filters['longitude'])) {
                    $query->orderByDesc('created_at');
                }
                break;
            case 'budget_high':
                $query->orderByDesc('budget_hint')->orderByDesc('created_at');
                break;
            case 'budget_low':
                $query->orderBy('budget_hint')->orderByDesc('created_at');
                break;
            default:
                $query->orderByDesc('created_at');
        }

        return $query->paginate($perPage);
    }
}
