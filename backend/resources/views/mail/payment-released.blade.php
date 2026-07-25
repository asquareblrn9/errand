<x-mail::message>
# Payment Released 💸

Hi {{ $name }},

Your earnings have been released to your wallet.

<x-mail::panel>
**Amount: ₦{{ $amount }}**
</x-mail::panel>

You can withdraw this to your bank account from the wallet page.

<x-mail::button url="{{ url('/wallet') }}">
View Wallet
</x-mail::button>

Thanks,<br>
The Errand Boy Team
</x-mail::message>
