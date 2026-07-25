<x-mail::message>
# Time Extension Requested ⏰

Hi {{ $name }},

**{{ $erranderName }}** has requested **{{ $additionalMinutes }} more minutes** to complete your errand.

**Reason:** {{ $reason }}

Please review and approve or reject the request from your dashboard.

<x-mail::button url="{{ url('/requests') }}">
View Request
</x-mail::button>

If you don't respond, the original SLA timer will continue running.

Thanks,<br>
The Errand Boy Team
</x-mail::message>
