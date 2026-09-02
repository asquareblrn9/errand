<?php

declare(strict_types=1);

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Thrown when an errander tries to change their payout bank account more
 * than once in the same calendar month.
 */
class BankChangeLockedException extends HttpException
{
    public function __construct(public readonly string $nextChangeAt)
    {
        parent::__construct(
            422,
            "You can only change your bank account once per calendar month. You can change it again on {$nextChangeAt}."
        );
    }
}
