<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\User;

class UserPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->role->isStaff();
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, User $model): bool
    {
        // Users can view their own profile
        if ($user->id === $model->id) {
            return true;
        }

        // Admins can view any profile
        return $user->role->isStaff();
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, User $model): bool
    {
        // Users can update their own profile
        if ($user->id === $model->id) {
            return true;
        }

        // Admins can update any user (e.g., suspend, ban)
        return $user->role->isStaff();
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, User $model): bool
    {
        // Users can delete their own account
        if ($user->id === $model->id) {
            return true;
        }

        // Only super admins can delete other users
        return $user->role === UserRole::SuperAdmin;
    }

    /**
     * Determine whether the user can suspend another user.
     */
    public function suspend(User $user, User $model): bool
    {
        // Cannot suspend yourself
        if ($user->id === $model->id) {
            return false;
        }

        // Admins can suspend; super admins can suspend anyone including admins
        if ($user->role === UserRole::SuperAdmin) {
            return true;
        }

        if ($user->role === UserRole::Admin) {
            // Admins cannot suspend other admins
            return ! $model->role->isStaff();
        }

        return false;
    }

    /**
     * Determine whether the user can ban another user.
     */
    public function ban(User $user, User $model): bool
    {
        return $this->suspend($user, $model);
    }
}
