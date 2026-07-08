<?php

namespace App\Mail\Transport;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

class ResendTransport extends AbstractTransport
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
        return 'resend';
    }

    protected function doSend(SentMessage $message): void
    {
        if (!$this->apiKey || !$this->fromAddress) {
            throw new \RuntimeException('Resend is enabled but the API Key or From Address is missing.');
        }

        /** @var Email $email */
        $email = $message->getOriginalMessage();

        $from = $email->getFrom() ? $email->getFrom()[0] : null;
        $fromHeader = $from
            ? ($from->getName() ? "{$from->getName()} <{$from->getAddress()}>" : $from->getAddress())
            : ($this->fromName ? "{$this->fromName} <{$this->fromAddress}>" : $this->fromAddress);

        $payload = array_filter([
            'from'    => $fromHeader,
            'to'      => $this->mapAddresses($email->getTo()),
            'cc'      => $this->mapAddresses($email->getCc()) ?: null,
            'bcc'     => $this->mapAddresses($email->getBcc()) ?: null,
            'subject' => $email->getSubject() ?? '',
            'html'    => $email->getHtmlBody() ?: null,
            'text'    => $email->getTextBody() ?: null,
        ]);

        $res = Http::withToken($this->apiKey)
            ->post('https://api.resend.com/emails', $payload);

        if (!$res->successful()) {
            $err = $res->json('message') ?? $res->body();
            throw new \RuntimeException("Resend send failed: {$err}");
        }
    }

    /** @param Address[] $addresses */
    private function mapAddresses(array $addresses): array
    {
        return array_map(fn (Address $a) => $a->getAddress(), $addresses);
    }
}
