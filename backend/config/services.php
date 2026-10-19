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
        'secret_key' => env('PAYSTACK_SECRET_KEY', ''),
        'public_key' => env('PAYSTACK_PUBLIC_KEY', ''),
    ],

    'fcm' => [
        'server_key' => env('FCM_SERVER_KEY', ''),
        'sender_id' => env('FCM_SENDER_ID', ''),
    ],

    'sms' => [
        /*
         * Active SMS provider: smsgate, termii, twilio, arkesel, or africastalking.
         * Providers listed in failover are tried in order when the primary fails.
         */
        'provider' => env('SMS_PROVIDER', 'smsgate'),
        'failover' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('SMS_FAILOVER', ''))
        ))),
        'sender_id' => env('SMS_SENDER_ID', 'ErrandBoy'),

        'smsgate' => [
            'url' => env('SMS_GATEWAY_URL'),
            'username' => env('SMS_GATEWAY_USERNAME'),
            'password' => env('SMS_GATEWAY_PASSWORD'),
        ],

        'termii' => [
            'api_key' => env('TERMII_API_KEY'),
            'sender_id' => env('TERMII_SENDER_ID', env('SMS_SENDER_ID', 'ErrandBoy')),
            'channel' => env('TERMII_CHANNEL', 'generic'),
        ],

        'twilio' => [
            'account_sid' => env('TWILIO_ACCOUNT_SID'),
            'auth_token' => env('TWILIO_AUTH_TOKEN'),
            'from' => env('TWILIO_FROM'),
        ],

        'arkesel' => [
            'base_url' => env('ARKESEL_BASE_URL', 'https://sms.arkesel.com'),
            'api_key' => env('ARKESEL_API_KEY'),
            'sender_id' => env('ARKESEL_SENDER_ID', env('SMS_SENDER_ID', 'ErrandBoy')),
        ],

        'africastalking' => [
            'base_url' => env('AFRICASTALKING_BASE_URL'),
            'username' => env('AFRICASTALKING_USERNAME'),
            'api_key' => env('AFRICASTALKING_API_KEY'),
            // Leave empty to use Africa's Talking's shared default sender.
            'sender_id' => env('AFRICASTALKING_SENDER_ID'),
        ],
    ],

    'flutterwave' => [
        'base_url' => env('FLUTTERWAVE_BASE_URL', 'https://api.flutterwave.com/v3'),
        'secret_key' => env('FLUTTERWAVE_SECRET_KEY', ''),
        'public_key' => env('FLUTTERWAVE_PUBLIC_KEY', ''),
        'encryption_key' => env('FLUTTERWAVE_ENCRYPTION_KEY', ''),
        'secret_hash' => env('FLUTTERWAVE_SECRET_HASH'),
    ],

];
