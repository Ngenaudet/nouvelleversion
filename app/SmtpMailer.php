<?php
declare(strict_types=1);

/**
 * Client SMTP minimal (SSL/TLS + AUTH LOGIN), sans dépendance.
 * Suffisant pour envoyer un message authentifié via une boîte o2switch.
 */
final class SmtpMailer
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(private array $cfg) {}

    /**
     * @param string[] $recipients adresses e-mail (déjà validées)
     * @param string   $data       message complet (en-têtes + corps), lignes en \r\n
     */
    public function send(string $from, array $recipients, string $data): void
    {
        $host    = (string)($this->cfg['host'] ?? '');
        $port    = (int)($this->cfg['port'] ?? 465);
        $enc     = strtolower((string)($this->cfg['encryption'] ?? 'ssl'));
        $timeout = (int)($this->cfg['timeout'] ?? 15);
        if ($host === '') {
            throw new RuntimeException('SMTP : hôte non configuré');
        }

        $ctx = stream_context_create(['ssl' => [
            'verify_peer'       => true,
            'verify_peer_name'  => true,
            'allow_self_signed' => false,
            'SNI_enabled'       => true,
            'peer_name'         => $host,
        ]]);
        $remote = ($enc === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $this->socket = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
        if (!$this->socket) {
            throw new RuntimeException("SMTP : connexion impossible ($errno $errstr)");
        }
        stream_set_timeout($this->socket, $timeout);

        try {
            $this->expect(220);
            $ehloHost = preg_replace('/[^a-z0-9.-]/i', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost';
            $this->cmd('EHLO ' . $ehloHost, 250);

            if ($enc === 'tls') {
                $this->cmd('STARTTLS', 220);
                if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                    throw new RuntimeException('SMTP : échec STARTTLS');
                }
                $this->cmd('EHLO ' . $ehloHost, 250);
            }

            if (!empty($this->cfg['username'])) {
                $this->cmd('AUTH LOGIN', 334);
                $this->cmd(base64_encode((string)$this->cfg['username']), 334);
                $this->cmd(base64_encode((string)($this->cfg['password'] ?? '')), 235, true);
            }

            $this->cmd('MAIL FROM:<' . $from . '>', 250);
            foreach ($recipients as $rcpt) {
                $this->cmd('RCPT TO:<' . $rcpt . '>', [250, 251]);
            }
            $this->cmd('DATA', 354);
            // Dot-stuffing (RFC 5321 §4.5.2)
            $data = preg_replace('/^\./m', '..', $data);
            $this->write($data . "\r\n.");
            $this->expect(250);
            $this->cmd('QUIT', 221);
        } finally {
            if (is_resource($this->socket)) {
                fclose($this->socket);
            }
            $this->socket = null;
        }
    }

    private function cmd(string $line, int|array $expected, bool $secret = false): void
    {
        $this->write($line);
        $this->expect($expected, $secret ? '[masqué]' : $line);
    }

    private function write(string $line): void
    {
        if (fwrite($this->socket, $line . "\r\n") === false) {
            throw new RuntimeException('SMTP : écriture impossible');
        }
    }

    private function expect(int|array $codes, string $context = ''): void
    {
        $codes = (array)$codes;
        $response = '';
        while (($line = fgets($this->socket, 515)) !== false) {
            $response .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        $code = (int)substr($response, 0, 3);
        if (!in_array($code, $codes, true)) {
            $cmd = $context !== '' ? strtok($context, ' ') : 'connexion';
            throw new RuntimeException('SMTP : réponse inattendue à ' . $cmd . ' : ' . trim($response));
        }
    }
}
