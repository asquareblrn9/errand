<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class PlatformSetting extends Model
{
    protected $table = 'platform_settings';
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['key', 'value', 'type', 'group', 'label', 'description'];

    /** Get a setting value by key with optional default. */
    public static function get(string $key, mixed $default = null): mixed
    {
        return Cache::remember("setting:{$key}", 300, function () use ($key, $default) {
            $setting = static::find($key);
            if (!$setting) return $default;
            return $setting->castValue();
        });
    }

    /** Get multiple settings by group. */
    public static function getGroup(string $group): array
    {
        return Cache::remember("settings:{$group}", 300, function () use ($group) {
            return static::where('group', $group)->get()
                ->mapWithKeys(fn ($s) => [$s->key => $s->castValue()])
                ->toArray();
        });
    }

    /** Set a setting value and clear cache. */
    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => (string) $value]);
        Cache::forget("setting:{$key}");
        // Also clear group cache — find group
        $setting = static::find($key);
        if ($setting) Cache::forget("settings:{$setting->group}");
    }

    /** Cast the stored string value to its declared type. */
    public function castValue(): mixed
    {
        return match ($this->type) {
            'integer' => (int) $this->value,
            'float' => (float) $this->value,
            'boolean' => filter_var($this->value, FILTER_VALIDATE_BOOLEAN),
            'json' => json_decode($this->value, true),
            default => $this->value,
        };
    }
}
