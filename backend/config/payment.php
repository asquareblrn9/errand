<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Card Payment Providers
    |--------------------------------------------------------------------------
    |
    | These providers are available for card/bank payments on errand requests.
    | Each provider must have a corresponding implementation of
    | App\Services\PaymentProviderInterface.
    |
    | To add a new provider:
    | 1. Add its slug to this array
    | 2. Create an implementation of PaymentProviderInterface
    | 3. Register the mapping in PaymentProviderResolver
    |
    */

    'card_providers' => [
        'paystack',
        'flutterwave',
    ],

    /*
    |--------------------------------------------------------------------------
    | Default Card Provider
    |--------------------------------------------------------------------------
    |
    | The provider pre-selected in the payment UI.
    |
    */

    'default_card_provider' => env('DEFAULT_CARD_PROVIDER', 'flutterwave'),

];
