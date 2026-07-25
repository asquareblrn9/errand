<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkStartedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $requestTitle,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Work Started — {$this->requestTitle}",
            to: [$this->user->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.work-started',
            with: [
                'name' => $this->user->name,
                'requestTitle' => $this->requestTitle,
            ],
        );
    }
}
