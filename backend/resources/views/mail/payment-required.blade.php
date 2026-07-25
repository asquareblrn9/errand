<x-mail::message>
# Payment Required

Hi {{ $name }},

A bid on **{{ $requestTitle }}** has been accepted. Please complete payment to get your errand started.

<x-mail::panel>
**Amount: ₦{{ $bidAmount }}**
</x-mail::panel>

<x-mail::button url="{{ url('/requests/' . $requestId) }}">
Complete Payment
</x-mail::button>

The errander will be notified once payment is confirmed.

Thanks,<br>
The Errand Boy Team
</x-mail::message>
