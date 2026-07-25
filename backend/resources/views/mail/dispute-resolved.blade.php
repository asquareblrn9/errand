<x-mail::message>
# Dispute Resolved

Hi {{ $name }},

A dispute has been resolved.

<x-mail::panel>
**Outcome:** {{ $outcome }}
**Reason:** {{ $reason }}
**Details:** {{ $note }}
</x-mail::panel>

If the outcome includes funds, they have been credited to the appropriate wallet. Please check your wallet balance for details.

If you have questions, contact support.

Thanks,<br>
The Errand Boy Team
</x-mail::message>
