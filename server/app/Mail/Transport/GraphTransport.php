<?php

namespace App\Mail\Transport;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

class GraphTransport extends AbstractTransport
{
    public function __construct(
        private readonly string $tenantId,
        private readonly string $clientId,
        private readonly string $clientSecret,
        private readonly string $senderMailbox,
    ) {
        parent::__construct();
    }

    public function __toString(): string
    {
        return 'graph';
    }

    protected function doSend(SentMessage $message): void
    {
        if (!$this->tenantId || !$this->clientId || !$this->clientSecret || !$this->senderMailbox) {
            throw new \RuntimeException('Microsoft 365 mail is enabled but Tenant ID, Client ID, Client Secret, or Sender Mailbox is missing.');
        }

        /** @var Email $email */
        $email = $message->getOriginalMessage();

        $tokenRes = Http::asForm()->post("https://login.microsoftonline.com/{$this->tenantId}/oauth2/v2.0/token", [
            'client_id'     => $this->clientId,
            'client_secret' => $this->clientSecret,
            'scope'         => 'https://graph.microsoft.com/.default',
            'grant_type'    => 'client_credentials',
        ]);

        $accessToken = $tokenRes->json('access_token');
        if (!$accessToken) {
            $err = $tokenRes->json('error_description') ?? $tokenRes->json('error') ?? 'Unknown error acquiring token.';
            throw new \RuntimeException("Microsoft Graph auth failed: {$err}");
        }

        $payload = [
            'message' => [
                'subject' => $email->getSubject() ?? '',
                'body' => [
                    'contentType' => $email->getHtmlBody() ? 'HTML' : 'Text',
                    'content'     => $email->getHtmlBody() ?? $email->getTextBody() ?? '',
                ],
                'toRecipients'  => $this->mapAddresses($email->getTo()),
                'ccRecipients'  => $this->mapAddresses($email->getCc()),
                'bccRecipients' => $this->mapAddresses($email->getBcc()),
            ],
            'saveToSentItems' => false,
        ];

        $sendRes = Http::withToken($accessToken)
            ->post("https://graph.microsoft.com/v1.0/users/{$this->senderMailbox}/sendMail", $payload);

        if (!$sendRes->successful()) {
            $err = $sendRes->json('error.message') ?? $sendRes->body();
            throw new \RuntimeException("Microsoft Graph sendMail failed: {$err}");
        }
    }

    /** @param Address[] $addresses */
    private function mapAddresses(array $addresses): array
    {
        return array_map(fn (Address $a) => [
            'emailAddress' => array_filter([
                'address' => $a->getAddress(),
                'name'    => $a->getName() ?: null,
            ]),
        ], $addresses);
    }
}
