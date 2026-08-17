<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Response;

class PaymentRedirectController extends Controller
{
    /** GET /payments/complete/{providerRef} — minimal page shown after payment, auto-closes on mobile */
    public function complete(string $providerRef): Response
    {
        $html = <<<HTML
        <!DOCTYPE html>
        <html>
        <head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Complete</title>
        <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F8FAFC;color:#0F172A}.card{text-align:center;padding:40px;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08)}h1{color:#10B981;font-size:24px}p{color:#64748B;margin-top:8px}</style>
        </head>
        <body>
        <div class="card"><h1>✅ Payment Complete</h1><p>You can close this page and return to the app.</p></div>
        </body>
        </html>
        HTML;

        return response($html);
    }
}
