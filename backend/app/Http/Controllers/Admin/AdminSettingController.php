<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AdminSettingController extends Controller
{
    /**
     * Get all platform settings grouped by category.
     *
     * GET /admin/settings
     */
    public function index(): JsonResponse
    {
        $settings = PlatformSetting::orderBy('group')->orderBy('key')->get()
            ->groupBy('group')
            ->map(fn ($group) => $group->map(fn ($s) => [
                'key' => $s->key,
                'value' => $s->castValue(),
                'type' => $s->type,
                'label' => $s->label,
                'description' => $s->description,
            ])->values());

        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Update platform settings in bulk.
     *
     * PUT /admin/settings
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*.key' => ['required', 'string', 'exists:platform_settings,key'],
            'settings.*.value' => ['required'],
        ]);

        foreach ($validated['settings'] as $item) {
            PlatformSetting::set($item['key'], $item['value']);
        }

        // Audit log settings changes
        \App\Models\AuditLog::log(
            action: 'admin.settings_updated',
            actor: $request->user(),
            model: null,
            oldValues: null,
            newValues: null,
            metadata: ['keys' => array_column($validated['settings'], 'key')],
        );

        // Clear all settings cache
        Cache::forget('setting:*');
        Cache::forget('settings:*');

        return response()->json([
            'success' => true,
            'message' => 'Settings updated successfully.',
        ]);
    }
}
