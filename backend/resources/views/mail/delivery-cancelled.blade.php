<x-mail::message>
# Errand Cancelled

Hi {{ $name }},

This errand has been cancelled by the requester.

**Reason:** {{ $reason }}

<x-mail::panel>
A refund has been initiated for the payment.
</x-mail::panel>

If you have any questions, please contact support.

Thanks,<br>
The Errand Boy Team
</x-mail::message>
