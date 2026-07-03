<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Reminder</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: #f0f2f8;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1e2a45;
            padding: 32px 16px;
        }
        .wrapper {
            max-width: 560px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b5fc0 100%);
            border-radius: 12px 12px 0 0;
            padding: 28px 32px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.3px;
        }
        .header p {
            color: rgba(255,255,255,0.75);
            font-size: 13px;
            margin-top: 4px;
        }
        .card {
            background: #ffffff;
            border-radius: 0 0 12px 12px;
            padding: 32px;
            box-shadow: 0 4px 24px rgba(30,42,69,0.08);
        }
        .greeting {
            font-size: 15px;
            color: #374151;
            margin-bottom: 20px;
        }
        .countdown-badge {
            display: inline-block;
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            border-radius: 20px;
            padding: 6px 16px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
        }
        .booking-block {
            background: #f8faff;
            border: 1px solid #e5eaf5;
            border-left: 4px solid #3b5fc0;
            border-radius: 8px;
            padding: 20px 24px;
            margin-bottom: 24px;
        }
        .booking-title {
            font-size: 17px;
            font-weight: 700;
            color: #1e2a45;
            margin-bottom: 16px;
        }
        .detail-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 10px;
            font-size: 14px;
            color: #374151;
        }
        .detail-icon {
            width: 18px;
            text-align: center;
            flex-shrink: 0;
            margin-top: 1px;
            color: #6b7280;
        }
        .detail-label {
            color: #6b7280;
            font-size: 12px;
            margin-bottom: 1px;
        }
        .detail-value {
            font-weight: 500;
        }
        .divider {
            height: 1px;
            background: #e5eaf5;
            margin: 20px 0;
        }
        .cta-text {
            font-size: 14px;
            color: #374151;
            margin-bottom: 16px;
        }
        .btn {
            display: block;
            text-align: center;
            background: #1e3a8a;
            color: #ffffff !important;
            text-decoration: none;
            padding: 13px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.2px;
        }
        .btn:hover { background: #1e40af; }
        .footer {
            text-align: center;
            margin-top: 24px;
            font-size: 12px;
            color: #9ca3af;
            line-height: 1.6;
        }
        .app-name { font-weight: 600; color: #6b7280; }
    </style>
</head>
<body>
<div class="wrapper">

    <div class="header">
        <h1>{{ config('app.name') }}</h1>
        <p>Meeting Room Booking System</p>
    </div>

    <div class="card">
        <p class="greeting">Hi, <strong>{{ $recipient->name }}</strong></p>

        @php
            $minutesUntil = (int) \Carbon\Carbon::parse($booking->start_at)->diffInMinutes(\Carbon\Carbon::now());
        @endphp
        <span class="countdown-badge">
            ⏰ Starting in ~{{ $minutesUntil }} minute{{ $minutesUntil !== 1 ? 's' : '' }}
        </span>

        <div class="booking-block">
            <div class="booking-title">{{ $booking->title }}</div>

            <div class="detail-row">
                <span class="detail-icon">🏢</span>
                <div>
                    <div class="detail-label">Room</div>
                    <div class="detail-value">
                        {{ $booking->room->name }}
                        @if($booking->room->relationLoaded('building') && $booking->room->building)
                            &mdash; {{ $booking->room->building->name }}
                        @endif
                    </div>
                </div>
            </div>

            <div class="detail-row">
                <span class="detail-icon">📅</span>
                <div>
                    <div class="detail-label">Date</div>
                    <div class="detail-value">{{ \Carbon\Carbon::parse($booking->start_at)->format('l, d F Y') }}</div>
                </div>
            </div>

            <div class="detail-row">
                <span class="detail-icon">🕐</span>
                <div>
                    <div class="detail-label">Time</div>
                    <div class="detail-value">
                        {{ \Carbon\Carbon::parse($booking->start_at)->format('H:i') }}
                        –
                        {{ \Carbon\Carbon::parse($booking->end_at)->format('H:i') }}
                    </div>
                </div>
            </div>

            @if($booking->description)
            <div class="detail-row">
                <span class="detail-icon">📝</span>
                <div>
                    <div class="detail-label">Notes</div>
                    <div class="detail-value">{{ $booking->description }}</div>
                </div>
            </div>
            @endif
        </div>

        @if($booking->room->requires_contact)
        <div class="divider"></div>
        <p class="cta-text">Please confirm your attendance so the room stays reserved for you:</p>
        <a href="{{ env('FRONTEND_URL', 'http://localhost:5173') }}/confirm/{{ $booking->id }}" class="btn">
            Confirm Attendance
        </a>
        @else
        <p class="cta-text" style="color:#6b7280; font-size:13px;">
            Head to the room a few minutes early. No confirmation needed for this booking.
        </p>
        @endif

        <div class="divider"></div>
        <p style="font-size:13px; color:#6b7280;">
            If you can no longer attend, please cancel your booking in the system so others can use the room.
        </p>
    </div>

    <div class="footer">
        <p>This reminder was sent automatically by <span class="app-name">{{ config('app.name') }}</span>.</p>
        <p>Please do not reply to this email.</p>
    </div>

</div>
</body>
</html>
