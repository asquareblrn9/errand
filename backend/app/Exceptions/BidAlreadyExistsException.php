<?php

declare(strict_types=1);

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

class BidAlreadyExistsException extends HttpException
{
    public function __construct(string $message = 'You have already submitted a bid on this request.')
    {
        parent::__construct(422, $message);
    }
}
