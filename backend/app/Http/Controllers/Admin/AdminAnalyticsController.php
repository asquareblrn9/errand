<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAnalyticsController extends Controller
{
    public function index(Request $request): JsonResponse|\Illuminate\Http\Response
    {
        $range = $request->input('range', '30d');
        $from = $request->input('from');
        $to = $request->input('to');

        $startDate = match ($range) {
            'today' => now()->startOfDay(),
            '7d' => now()->subDays(7)->startOfDay(),
            '90d' => now()->subDays(90)->startOfDay(),
            'custom' => $from ? now()->parse($from)->startOfDay() : now()->subDays(30)->startOfDay(),
            default => now()->subDays(30)->startOfDay(),
        };

        $endDate = ($range === 'custom' && $to) ? now()->parse($to)->endOfDay() : now()->endOfDay();

        if ($request->input('format') === 'csv') {
            return $this->exportCsv($startDate, $endDate);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'revenue' => $this->revenueChart($startDate, $endDate),
                'jobs' => $this->jobsChart($startDate, $endDate),
                'users' => $this->usersChart($startDate, $endDate),
                'summary' => [
                    'total_revenue' => round((float) (DB::table('wallet_transactions')->where('type', 'deposit')->whereBetween('created_at', [$startDate, $endDate])->sum('amount') ?? 0), 2),
                    'total_payouts' => round((float) (DB::table('wallet_transactions')->where('type', 'payout')->whereBetween('created_at', [$startDate, $endDate])->sum('amount') ?? 0), 2),
                    'total_jobs' => DB::table('requests')->whereBetween('created_at', [$startDate, $endDate])->count(),
                    'completed_jobs' => DB::table('requests')->where('status', 'completed')->whereBetween('created_at', [$startDate, $endDate])->count(),
                    'new_users' => DB::table('users')->whereBetween('created_at', [$startDate, $endDate])->count(),
                ],
            ],
        ]);
    }

    private function revenueChart($start, $end): array
    {
        $deposits = DB::table('wallet_transactions')
            ->selectRaw("DATE(created_at) as date, SUM(amount) as total")
            ->where('type', 'deposit')
            ->whereBetween('created_at', [$start, $end])
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date')->get();

        $payouts = DB::table('wallet_transactions')
            ->selectRaw("DATE(created_at) as date, SUM(amount) as total")
            ->where('type', 'payout')
            ->whereBetween('created_at', [$start, $end])
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date')->get();

        return [
            'deposits' => $deposits->map(fn ($d) => ['date' => $d->date, 'amount' => round((float) ($d->total ?? 0), 2)]),
            'payouts' => $payouts->map(fn ($d) => ['date' => $d->date, 'amount' => round((float) ($d->total ?? 0), 2)]),
        ];
    }

    private function jobsChart($start, $end): array
    {
        $created = DB::table('requests')
            ->selectRaw("DATE(created_at) as date, COUNT(*) as count")
            ->whereBetween('created_at', [$start, $end])
            ->groupByRaw('DATE(created_at)')->orderBy('date')->get();

        $completed = DB::table('requests')
            ->selectRaw("DATE(created_at) as date, COUNT(*) as count")
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->groupByRaw('DATE(created_at)')->orderBy('date')->get();

        return [
            'created' => $created->map(fn ($d) => ['date' => $d->date, 'count' => $d->count]),
            'completed' => $completed->map(fn ($d) => ['date' => $d->date, 'count' => $d->count]),
        ];
    }

    private function usersChart($start, $end): array
    {
        $registrations = DB::table('users')
            ->selectRaw("DATE(created_at) as date, COUNT(*) as count")
            ->whereBetween('created_at', [$start, $end])
            ->groupByRaw('DATE(created_at)')->orderBy('date')->get();

        return [
            'registrations' => $registrations->map(fn ($d) => ['date' => $d->date, 'count' => $d->count]),
        ];
    }

    private function exportCsv($start, $end): \Illuminate\Http\Response
    {
        $revenue = $this->revenueChart($start, $end);
        $jobs = $this->jobsChart($start, $end);
        $users = $this->usersChart($start, $end);

        $csv = fopen('php://temp', 'r+');
        fputcsv($csv, ['Type', 'Date', 'Value']);
        foreach ($revenue['deposits'] as $d) fputcsv($csv, ['Revenue (Deposits)', $d['date'], $d['amount']]);
        foreach ($revenue['payouts'] as $d) fputcsv($csv, ['Revenue (Payouts)', $d['date'], $d['amount']]);
        foreach ($jobs['created'] as $d) fputcsv($csv, ['Jobs Created', $d['date'], $d['count']]);
        foreach ($jobs['completed'] as $d) fputcsv($csv, ['Jobs Completed', $d['date'], $d['count']]);
        foreach ($users['registrations'] as $d) fputcsv($csv, ['User Registrations', $d['date'], $d['count']]);
        rewind($csv);
        $content = stream_get_contents($csv);
        fclose($csv);

        return response($content, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="analytics-' . now()->format('Ymd-His') . '.csv"',
        ]);
    }
}
