import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

// laravel-echo expects Pusher on the global scope for the reverb broadcaster.
;(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher

const scheme = import.meta.env.VITE_REVERB_SCHEME ?? 'http'

/**
 * Singleton Echo instance wired to the Laravel Reverb WebSocket server.
 * We only use a PUBLIC channel ('bookings'), so no broadcasting-auth endpoint
 * or token wiring is required here.
 */
export const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
  wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  forceTLS: scheme === 'https',
  enabledTransports: ['ws', 'wss'],
})
