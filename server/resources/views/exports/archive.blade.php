<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 9px; color: #1e293b; margin: 0; padding: 16px; }
  h1 { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px; }
  p.sub { font-size: 8px; color: #64748b; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #000; color: #adee2b; }
  thead th { padding: 5px 6px; text-align: left; font-size: 7px; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
</style>
</head>
<body>
  <h1>Booking Archive Export</h1>
  <p class="sub">Generated: {{ $label }} &nbsp;·&nbsp; {{ count($rows) }} records</p>
  <table>
    <thead>
      <tr>@foreach($cols as $col)<th>{{ $col }}</th>@endforeach</tr>
    </thead>
    <tbody>
      @foreach($rows as $row)
      <tr>@foreach($row as $cell)<td>{{ $cell }}</td>@endforeach</tr>
      @endforeach
    </tbody>
  </table>
</body>
</html>
