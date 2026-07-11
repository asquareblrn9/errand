<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\RequestStatus;
use App\Models\Request;
use App\Models\User;

class RequestPolicy
{
    public function viewAny(?User $user): bool
    {
        return true; // Feed is accessible to authenticated erranders
    }

    public function view(?User $user, Request $request): bool
    {
        return true; // Any authenticated user can view a request
    }

    public function create(User $user): bool
    {
        return $user->role->canCreateRequests();
    }

    public function update(User $user, Request $request): bool
    {
        if (! $request->isOwnedBy($user)) {
            return false;
        }

        return $request->status->isEditable();
    }

    public function delete(User $user, Request $request): bool
    {
        if (! $request->isOwnedBy($user)) {
            return false;
        }

        return $request->status === RequestStatus::Open
            || $request->status === RequestStatus::Draft;
    }
}
