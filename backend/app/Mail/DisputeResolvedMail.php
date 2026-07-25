<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DisputeResolvedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $outcome,
        public readonly string $reason,
        public readonly string $note,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Dispute Resolved — {$this->outcome}",
            to: [$this->user->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.dispute-resolved',
            with: [
                'name' => $this->user->name,
                'outcome' => $this->outcome,
                'reason' => $this->reason,
                'note' => $this->note,
            ],
        );
    }
}
