<x-mail::message>
# New Work Available! 🎉

Hi {{ $name }},

Great news — a requester has paid for your bid on **{{ $requestTitle }}**.

<x-mail::panel>
**Amount: ₦{{ $amount }}**
</x-mail::panel>

The payment has been secured in escrow. You can now start the errand.

<x-mail::button url="{{ url('/requests/' . $requestId) }}">
View Request
</x-mail::button>

Get started before the SLA clock begins ticking!

Thanks,<br>
The Errand Boy Team
</x-mail::message>
