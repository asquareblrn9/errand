<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ExtensionDecidedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly bool $approved,
        public readonly int $additionalMinutes,
    ) {}

    public function envelope(): Envelope
    {
        $verb = $this->approved ? 'Approved' : 'Rejected';
        return new Envelope(
            subject: "Time Extension {$verb} — {$this->additionalMinutes} minutes",
            to: [$this->user->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.extension-decided',
            with: [
                'name' => $this->user->name,
                'approved' => $this->approved,
                'additionalMinutes' => $this->additionalMinutes,
            ],
        );
    }
}
