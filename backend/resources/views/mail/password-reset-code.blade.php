<x-mail::message>
# Reset Your Password

Hi {{ $name }},

We received a request to reset your password. Use the code below to complete the process:

<x-mail::panel>
**{{ $code }}**
</x-mail::panel>

This code expires in **{{ $expiresIn }} minutes**. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.

<x-mail::button url="{{ url('/reset-password') }}">
Reset Password
</x-mail::button>

Thanks,<br>
The Errand Boy Team
</x-mail::message>
