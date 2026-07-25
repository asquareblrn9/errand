<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ExtensionRequestedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $erranderName,
        public readonly int $additionalMinutes,
        public readonly string $reason,
        public readonly string $extensionId,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Time Extension Requested — {$this->erranderName} needs {$this->additionalMinutes} more minutes",
            to: [$this->user->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.extension-requested',
            with: [
                'name' => $this->user->name,
                'erranderName' => $this->erranderName,
                'additionalMinutes' => $this->additionalMinutes,
                'reason' => $this->reason,
                'extensionId' => $this->extensionId,
            ],
        );
    }
}
