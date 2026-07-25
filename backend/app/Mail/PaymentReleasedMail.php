<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentReleasedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $amount,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "₦{$this->amount} Released to Your Wallet 💸",
            to: [$this->user->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.payment-released',
            with: [
                'name' => $this->user->name,
                'amount' => $this->amount,
            ],
        );
    }
}
