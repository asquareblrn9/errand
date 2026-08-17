<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AdminBroadcastMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $title,
        public readonly string $message,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->title, to: [$this->user->email]);
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.admin-broadcast', with: [
            'name' => $this->user->name,
            'body' => $this->message,
        ]);
    }
}
