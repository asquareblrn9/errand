<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\WalletFunding;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PaymentRedirectController extends Controller
{
    /**
     * GET /payments/complete/{providerRef} — shown after the provider checkout.
     *
     * The page immediately deep-links back into the mobile app so the user
     * returns to where they initiated payment:
     *  - errandboy://requests/{id}?payment_ref=...  (bid card payments)
     *  - errandboy://wallet?payment_ref=...         (wallet funding)
     * The app then verifies server-side. A manual fallback link is rendered
     * for browsers that block the automatic navigation.
     */
    public function complete(Request $request, string $providerRef): Response
    {
        $payment = Payment::where('provider_ref', $providerRef)->first();
        $funding = $payment ? null : WalletFunding::where('provider_ref', $providerRef)->first();
        $status = $request->query('status', 'pending');

        $deepLink = null;
        $headline = 'Payment Complete';
        $message = 'You can return to the app to continue.';

        if ($payment) {
            $deepLink = "errandboy://requests/{$payment->request_id}?payment_ref={$payment->provider_ref}&status={$status}";
        } elseif ($funding) {
            $deepLink = "errandboy://wallet?payment_ref={$funding->provider_ref}&status={$status}&provider={$funding->provider}";
        }

        if ($deepLink) {
            $headline = match ($status) {
                'successful' => '✅ Payment Successful',
                'failed' => '❌ Payment Failed',
                'cancelled' => 'Payment Cancelled',
                default => '⏳ Payment Processing',
            };

            $message = match ($status) {
                'successful' => 'Your payment was successful. Returning you to the app…',
                'failed' => 'Your payment was not successful. Returning you to the app so you can try again…',
                'cancelled' => 'You cancelled the payment. Returning you to the app…',
                default => 'Your payment is still processing. Returning you to the app to confirm…',
            };
        }

        $escapedDeepLink = $deepLink ? e($deepLink) : null;
        $escapedHeadline = e($headline);
        $escapedMessage = e($message);

        // Script bodies are raw text — HTML entities (&amp;) are NOT decoded
        // there, which would mangle every query param after the first "&".
        // JSON-encode instead: safe quotes + no tag-breaking characters.
        $redirectScript = $deepLink
            ? '<script>window.location.replace('.json_encode($deepLink, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT).');</script>'
            : '';

        $redirectMeta = $escapedDeepLink
            ? "<meta http-equiv=\"refresh\" content=\"0;url={$escapedDeepLink}\" />"
            : '';

        $manualLink = $escapedDeepLink
            ? "<p><a href=\"{$escapedDeepLink}\">Return to the Errand Boy app</a></p>"
            : '';

        $html = <<<HTML
        <!DOCTYPE html>
        <html>
        <head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Complete</title>
        {$redirectMeta}
        <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F8FAFC;color:#0F172A}.card{text-align:center;padding:40px;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08)}h1{color:#10B981;font-size:24px}p{color:#64748B;margin-top:8px}a{color:#1D4FB8}</style>
        </head>
        <body>
        <div class="card"><h1>{$escapedHeadline}</h1><p>{$escapedMessage}</p>{$manualLink}</div>
        {$redirectScript}
        </body>
        </html>
        HTML;

        return response($html);
    }
}
