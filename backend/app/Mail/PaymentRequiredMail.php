<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentRequiredMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $bidAmount,
        public readonly string $requestTitle,
        public readonly string $requestId,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Action Required — Complete Payment of ₦{$this->bidAmount}",
            to: [$this->user->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.payment-required',
            with: [
                'name' => $this->user->name,
                'bidAmount' => $this->bidAmount,
                'requestTitle' => $this->requestTitle,
                'requestId' => $this->requestId,
            ],
        );
    }
}
