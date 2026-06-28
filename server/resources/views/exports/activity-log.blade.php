<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #111827; background: #fff; padding: 20px; }
  h1 { font-size: 16px; font-weight: 900; color: #111827; margin-bottom: 2px; }
  .meta { font-size: 8px; color: #6b7280; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #111827; color: #fff; font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 8px; text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  .cat { display: inline-block; padding: 1px 6px; border-radius: 99px; font-size: 7px; font-weight: 700; text-transform: uppercase; }
  .cat-booking  { background: #dbeafe; color: #1d4ed8; }
  .cat-user     { background: #f3e8ff; color: #7e22ce; }
  .cat-settings { background: #fef3c7; color: #92400e; }
  .cat-data     { background: #fee2e2; color: #b91c1c; }
  .cat-default  { background: #f3f4f6; color: #374151; }
  .actor { font-weight: 700; }
  .role { color: #9ca3af; font-size: 8px; }
  .ip { font-family: monospace; color: #9ca3af; }
  .action { font-size: 8px; color: #6366f1; font-weight: 600; }
</style>
</head>
<body>
  <h1>Activity Log — {{ $catLabel }}</h1>
  <p class="meta">Generated {{ $generatedAt }} · {{ count($logs) }} entries</p>
  <table>
    <thead>
      <tr>
        <th style="width:13%">Date / Time</th>
        <th style="width:8%">Category</th>
        <th style="width:16%">Action</th>
        <th style="width:37%">Description</th>
        <th style="width:13%">Actor</th>
        <th style="width:13%">IP Address</th>
      </tr>
    </thead>
    <tbody>
      @foreach($logs as $l)
      <tr>
        <td>{{ $l->created_at?->format('Y-m-d H:i:s') }}</td>
        <td>
          <span class="cat cat-{{ in_array($l->category, ['booking','user','settings','data']) ? $l->category : 'default' }}">
            {{ ucfirst($l->category) }}
          </span>
        </td>
        <td class="action">{{ str_replace('.', ' · ', $l->action) }}</td>
        <td>{{ $l->description }}</td>
        <td>
          <span class="actor">{{ $l->user?->name ?? 'System' }}</span>
          @if($l->user)
          <br><span class="role">{{ $l->user->role }}</span>
          @endif
        </td>
        <td class="ip">{{ $l->ip_address ?? '—' }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>
</body>
</html>
