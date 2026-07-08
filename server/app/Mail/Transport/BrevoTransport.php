<?php

namespace App\Mail\Transport;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

class BrevoTransport extends AbstractTransport
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $fromAddress,
        private readonly string $fromName,
    ) {
        parent::__construct();
    }

    public function __toString(): string
    {
        return 'brevo';
    }

    protected function doSend(SentMessage $message): void
    {
        if (!$this->apiKey || !$this->fromAddress) {
            throw new \RuntimeException('Brevo is enabled but the API Key or From Address is missing.');
        }

        /** @var Email $email */
        $email = $message->getOriginalMessage();

        $from = $email->getFrom() ? $email->getFrom()[0] : null;
        $sender = $from
            ? array_filter(['email' => $from->getAddress(), 'name' => $from->getName() ?: null])
            : array_filter(['email' => $this->fromAddress, 'name' => $this->fromName ?: null]);

        $payload = array_filter([
            'sender'      => $sender,
            'to'          => $this->mapAddresses($email->getTo()),
            'cc'          => $this->mapAddresses($email->getCc()) ?: null,
            'bcc'         => $this->mapAddresses($email->getBcc()) ?: null,
            'subject'     => $email->getSubject() ?? '',
            'htmlContent' => $email->getHtmlBody() ?: ($email->getTextBody() ? '<pre>' . e($email->getTextBody()) . '</pre>' : ''),
        ]);

        $res = Http::withHeaders(['api-key' => $this->apiKey])
            ->post('https://api.brevo.com/v3/smtp/email', $payload);

        if (!$res->successful()) {
            $err = $res->json('message') ?? $res->body();
            throw new \RuntimeException("Brevo send failed: {$err}");
        }
    }

    /** @param Address[] $addresses */
    private function mapAddresses(array $addresses): array
    {
        return array_map(fn (Address $a) => array_filter([
            'email' => $a->getAddress(),
            'name'  => $a->getName() ?: null,
        ]), $addresses);
    }
}
