<x-mail::message>
# Verify Your Email Address

Hi {{ $name }},

Welcome to Errand Boy! Use the verification code below to verify your email address:

<x-mail::panel>
**{{ $code }}**
</x-mail::panel>

This code expires in **{{ $expiresIn }} minutes**. If you didn't create an account, you can safely ignore this email.

<x-mail::button url="{{ url('/verify-email') }}">
Verify Email
</x-mail::button>

Thanks,<br>
The Errand Boy Team
</x-mail::message>
