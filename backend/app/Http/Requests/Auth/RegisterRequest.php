<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\Password;

/**
 * Validate user registration.
 *
 * Acceptable roles for self-registration are limited to
 * 'requester' and 'errander'. Admin/company roles must be
 * assigned by an existing authorized user.
 */
class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'date_of_birth' => [
                'required',
                'date',
                'before:' . now()->subYears(18)->format('Y-m-d'),
            ],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => [
                'required',
                'string',
                'max:20',
                'unique:users,phone',
                'regex:/^\+?[1-9]\d{6,14}$/',
            ],
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(8)
                    ->letters()
                    ->mixedCase()
                    ->numbers()
                    ->symbols()
                    ->when(app()->isProduction(), fn ($rule) => $rule->uncompromised()),
            ],
            'role' => [
                'required',
                'string',
                new Enum(UserRole::class),
                function (string $attribute, string $value, \Closure $fail): void {
                    if (!in_array(UserRole::from($value), [UserRole::Requester, UserRole::Errander], true)) {
                        $fail('You may only register as a requester or errander.');
                    }
                },
            ],
            'device_name' => ['nullable', 'string', 'max:100'],
            'device_type' => ['nullable', 'string', 'in:android,ios,web', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date_of_birth.before' => 'You must be at least 18 years old to register.',
            'phone.regex' => 'The phone number must be in international format (e.g., +2348012345678).',
            'password.uncompromised' => 'This password has appeared in a data breach. Please choose a different password.',
        ];
    }
}
