<?php

declare(strict_types=1);

namespace App\Enums;

enum WalletTransactionType: string
{
    case Deposit = 'deposit';
    case Withdrawal = 'withdrawal';
    case Payment = 'payment';
    case Refund = 'refund';
    case Payout = 'payout';
    case Fee = 'fee';
    case Lock = 'lock';
    case Unlock = 'unlock';
    case Adjustment = 'adjustment';
}
