<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'description' => ['required', 'string', 'max:2000'],
            'category_id' => ['required', 'uuid', 'exists:categories,id'],
            'location' => ['required', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'min:-90', 'max:90'],
            'longitude' => ['required', 'numeric', 'min:-180', 'max:180'],
            'budget_hint' => ['nullable', 'numeric', 'min:500', 'max:500000'],
            'is_urgent' => ['sometimes', 'boolean'],
            'sla_minutes' => ['nullable', 'integer', 'min:15', 'max:10080'], // 15 min to 7 days
            'company_id' => ['nullable', 'uuid'],
            'photos' => ['nullable', 'array', 'max:5'],
            'photos.*' => ['image', 'mimes:jpeg,png,webp', 'max:5120'],
        ];
    }
}
