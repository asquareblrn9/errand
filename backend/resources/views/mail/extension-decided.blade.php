<x-mail::message>
@if ($approved)
# Extension Approved ✅

Hi {{ $name }},

Your request for **{{ $additionalMinutes }} more minutes** has been approved. The SLA timer has been extended.

You can continue working with no late penalty.
@else
# Extension Rejected ❌

Hi {{ $name }},

Your request for **{{ $additionalMinutes }} more minutes** was rejected. The original SLA timer remains in effect.

Please try to complete the delivery as soon as possible to avoid late fees.
@endif

Thanks,<br>
The Errand Boy Team
</x-mail::message>
