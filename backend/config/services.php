<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'maps_api_key' => env('GOOGLE_MAPS_API_KEY'),
    ],

    'paystack' => [
        'base_url' => env('PAYSTACK_BASE_URL', 'https://api.paystack.co'),
        'secret_key' => env('PAYSTACK_SECRET_KEY'),
        'public_key' => env('PAYSTACK_PUBLIC_KEY'),
    ],

    'fcm' => [
        'server_key' => env('FCM_SERVER_KEY'),
        'sender_id' => env('FCM_SENDER_ID'),
    ],

    'flutterwave' => [
        'base_url' => env('FLUTTERWAVE_BASE_URL', 'https://api.flutterwave.com/v3'),
        'secret_key' => env('FLUTTERWAVE_SECRET_KEY'),
        'public_key' => env('FLUTTERWAVE_PUBLIC_KEY'),
        'encryption_key' => env('FLUTTERWAVE_ENCRYPTION_KEY'),
    ],

];
