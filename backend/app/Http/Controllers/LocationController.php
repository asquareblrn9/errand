<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class LocationController extends Controller
{
    /** GET /places/autocomplete?input=... — proxy Google Places Autocomplete */
    public function autocomplete(Request $request): JsonResponse
    {
        $input = $request->input('input');
        if (! $input || strlen($input) < 3) {
            return response()->json(['predictions' => []]);
        }

        $key = config('services.google.maps_api_key');
        if (! $key) {
            return response()->json(['error' => 'Maps API key not configured'], 500);
        }

        $response = Http::get('https://maps.googleapis.com/maps/api/place/autocomplete/json', [
            'input' => $input,
            'components' => 'country:ng',
            'key' => $key,
        ]);

        $data = $response->json();

        return response()->json([
            'predictions' => collect($data['predictions'] ?? [])->map(fn ($p) => [
                'place_id' => $p['place_id'],
                'description' => $p['description'],
            ]),
        ]);
    }

    /** GET /places/details?place_id=... — proxy Google Place Details */
    public function details(Request $request): JsonResponse
    {
        $placeId = $request->input('place_id');
        if (! $placeId) {
            return response()->json(['error' => 'place_id required'], 422);
        }

        $key = config('services.google.maps_api_key');
        if (! $key) {
            return response()->json(['error' => 'Maps API key not configured'], 500);
        }

        $response = Http::get('https://maps.googleapis.com/maps/api/place/details/json', [
            'place_id' => $placeId,
            'fields' => 'geometry',
            'key' => $key,
        ]);

        $data = $response->json();

        return response()->json([
            'location' => $data['result']['geometry']['location'] ?? null,
        ]);
    }
}
