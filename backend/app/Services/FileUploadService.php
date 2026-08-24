<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * FileUploadService
 *
 * Handles file uploads to S3 (production) or local disk (local/testing).
 * Generates optimized, publicly accessible URLs via CloudFront in production
 * or local asset URLs in development.
 */
class FileUploadService
{
    /**
     * Allowed MIME types for avatar uploads.
     */
    private const AVATAR_ALLOWED_TYPES = [
        'image/jpeg',
        'image/png',
        'image/webp',
    ];

    /**
     * Maximum avatar file size in bytes (5 MB).
     */
    private const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

    /**
     * Upload a user avatar.
     *
     * Files are stored in: {disk}/avatars/{user_id}_{random}.{ext}
     *
     * @return array{path: string, url: string}
     */
    public function uploadAvatar(UploadedFile $file, string $userId): array
    {
        $this->validateAvatar($file);

        $disk = $this->disk();
        $extension = $this->normalizeExtension($file);
        $filename = sprintf('avatars/%s_%s.%s', $userId, Str::random(12), $extension);

        // Store the file
        $path = $file->storeAs(dirname($filename), basename($filename), $disk);

        // Generate the public URL
        $url = $this->url($path);

        return [
            'path' => $path,
            'url' => $url,
        ];
    }

    /**
     * Upload a request photo.
     *
     * @return array{path: string, url: string}
     */
    public function uploadRequestPhoto(UploadedFile $file, string $requestId, int $index): array
    {
        $disk = $this->disk();
        $ext = match ($file->getMimeType()) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };
        $filename = sprintf('requests/%s_%d_%s.%s', $requestId, $index, Str::random(8), $ext);
        $path = $file->storeAs(dirname($filename), basename($filename), $disk);
        $url = $this->url($path);

        return ['path' => $path, 'url' => $url];
    }

    /**
     * Upload a KYC document (identity image/PDF or selfie photo).
     *
     * Files are stored in: {disk}/{directory}/{user_id}_{random}.{ext}
     *
     * @return array{path: string, url: string}
     */
    public function uploadKycDocument(UploadedFile $file, string $directory, string $userId): array
    {
        $disk = $this->disk();
        $extension = $this->normalizeExtension($file);
        $filename = sprintf('%s/%s_%s.%s', $directory, $userId, Str::random(12), $extension);

        // Store the file
        $path = $file->storeAs(dirname($filename), basename($filename), $disk);

        return [
            'path' => $path,
            'url' => $this->url($path),
        ];
    }

    /**
     * Delete a previously uploaded file.
     */
    public function delete(?string $path): void
    {
        if ($path) {
            Storage::disk($this->disk())->delete($path);
        }
    }

    /**
     * Get the storage disk to use.
     *
     * Uses 's3' in production with CloudFront, 'public' in local dev,
     * and 'public' in testing.
     */
    private function disk(): string
    {
        if (app()->environment('production')) {
            return 's3';
        }

        return 'public';
    }

    /**
     * Generate the public URL for a stored file.
     */
    private function url(string $path): string
    {
        if (app()->environment('production')) {
            // CloudFront CDN URL
            $cdnUrl = config('filesystems.disks.s3.cdn_url', '');
            if ($cdnUrl) {
                return rtrim($cdnUrl, '/').'/'.ltrim($path, '/');
            }

            return Storage::disk('s3')->url($path);
        }

        return asset('storage/'.$path);
    }

    /**
     * Validate the uploaded avatar file.
     */
    private function validateAvatar(UploadedFile $file): void
    {
        if (! in_array($file->getMimeType(), self::AVATAR_ALLOWED_TYPES, true)) {
            throw new \InvalidArgumentException(
                'Avatar must be a JPEG, PNG, or WebP image.'
            );
        }

        if ($file->getSize() > self::AVATAR_MAX_SIZE) {
            throw new \InvalidArgumentException(
                'Avatar must be less than 5 MB.'
            );
        }
    }

    /**
     * Normalize the file extension — WebP files sometimes report as 'jpeg' mime.
     */
    private function normalizeExtension(UploadedFile $file): string
    {
        return match ($file->getMimeType()) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => $file->getClientOriginalExtension() ?: 'jpg',
        };
    }
}
