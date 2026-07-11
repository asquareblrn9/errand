<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate login requests.
 *
 * Accepts either email OR phone via the 'login' field.
 * The controller resolves which field to authenticate against.
 */
class LoginRequest extends FormRequest
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
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'device_type' => ['nullable', 'string', 'in:android,ios,web', 'max:20'],
            'remember_me' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Determine if the login input is an email address.
     */
    public function isEmailLogin(): bool
    {
        return filter_var($this->input('login'), FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Get the authentication field name (email or phone).
     */
    public function authField(): string
    {
        return $this->isEmailLogin() ? 'email' : 'phone';
    }
}
