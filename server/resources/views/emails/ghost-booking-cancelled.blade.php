<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Auto-Cancelled</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: #f0f2f8;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1e2a45;
            padding: 32px 16px;
        }
        .wrapper { max-width: 560px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
            border-radius: 12px 12px 0 0;
            padding: 28px 32px;
            text-align: center;
        }
        .header h1 { color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
        .header p { color: rgba(255,255,255,0.75); font-size: 13px; margin-top: 4px; }
        .card {
            background: #ffffff;
            border-radius: 0 0 12px 12px;
            padding: 32px;
            box-shadow: 0 4px 24px rgba(30,42,69,0.08);
        }
        .greeting { font-size: 15px; color: #374151; margin-bottom: 20px; }
        .warn-badge {
            display: inline-block;
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
            border-radius: 20px;
            padding: 6px 16px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
        }
        .booking-block {
            background: #fafaff;
            border: 1px solid #f0e5e5;
            border-left: 4px solid #dc2626;
            border-radius: 8px;
            padding: 20px 24px;
            margin-bottom: 24px;
        }
        .booking-title { font-size: 17px; font-weight: 700; color: #1e2a45; margin-bottom: 16px; }
        .detail-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 14px; color: #374151; }
        .detail-icon { width: 18px; text-align: center; flex-shrink: 0; margin-top: 1px; color: #6b7280; }
        .detail-label { color: #6b7280; font-size: 12px; margin-bottom: 1px; }
        .detail-value { font-weight: 500; }
        .divider { height: 1px; background: #e5eaf5; margin: 20px 0; }
        .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; line-height: 1.6; }
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

        <span class="warn-badge">⚠️ Booking auto-cancelled — no presence confirmed</span>

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
        </div>

        <p style="font-size:14px; color:#374151;">
            This booking was automatically cancelled because presence wasn't confirmed within the required window, freeing up the room for others.
        </p>

        <div class="divider"></div>
        <p style="font-size:13px; color:#6b7280;">
            If this was a mistake, you're welcome to create a new booking if the room is still available.
        </p>
    </div>

    <div class="footer">
        <p>This notice was sent automatically by <span class="app-name">{{ config('app.name') }}</span>.</p>
        <p>Please do not reply to this email.</p>
    </div>

</div>
</body>
</html>
