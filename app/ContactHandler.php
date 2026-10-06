<?php
declare(strict_types=1);

require_once __DIR__ . '/SmtpMailer.php';

/**
 * Traitement du formulaire de contact Nouvelle Version.
 *
 * Défenses : POST uniquement, contrôle d'origine, jeton signé (HMAC) avec
 * délai minimal de remplissage, champ piège (honeypot), limitation de débit
 * par visiteur + plafond quotidien, validation stricte, protection contre
 * l'injection d'en-têtes, limite de taille.
 */
final class ContactHandler
{
    private const SOLUTIONS  = ['Nouvelle Page', 'Nouvelle Version', 'Nouvelle Dimension'];
    private const MAX_BODY   = 20000; // octets

    private array $cfg;
    private string $storage;
    private string $secret;

    public function __construct(array $cfg)
    {
        $this->cfg     = $cfg;
        $this->storage = __DIR__ . '/storage';
        $this->ensureStorage();
        $this->secret  = $this->loadSecret();
    }

    /* ================================================================
       Point d'entrée
       ================================================================ */
    public function run(): void
    {
        $this->baseHeaders();
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        if ($method === 'GET' && ($_GET['action'] ?? '') === 'token') {
            $this->json(200, ['ok' => true, 'token' => $this->issueToken()]);
        }
        if ($method !== 'POST') {
            header('Allow: POST, GET');
            $this->respond(405, false, 'Méthode non autorisée.');
        }
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > self::MAX_BODY) {
            $this->respond(413, false, 'Votre message est trop long.');
        }
        if (!$this->originAllowed()) {
            $this->respond(403, false, 'Requête refusée.');
        }

        // Champ piège : un robot le remplit, un humain ne le voit pas.
        // On répond « succès » pour ne rien apprendre au robot.
        if (trim((string)($_POST['website'] ?? '')) !== '') {
            $this->respond(200, true, 'Merci, votre message a bien été envoyé.');
        }

        if (!$this->tokenValid((string)($_POST['token'] ?? ''), $tokenError)) {
            $this->respond(400, false, $tokenError);
        }

        [$data, $errors] = $this->validate($_POST);
        if ($errors) {
            $this->respond(422, false, 'Certains champs sont à corriger.', $errors);
        }

        if (!$this->rateLimitOk()) {
            $this->respond(429, false, 'Trop de demandes envoyées. Réessayez dans une heure ou écrivez-nous directement par e-mail.');
        }

        try {
            $this->sendNotification($data);
            if (!empty($this->cfg['send_copy_to_visitor'])) {
                $this->sendAcknowledgement($data);
            }
        } catch (Throwable $e) {
            $this->log('Échec d\'envoi : ' . $e->getMessage());
            $this->respond(500, false, 'L\'envoi a échoué. Merci de réessayer ou de nous écrire à ' . $this->cfg['to'] . '.');
        }

        $this->recordSend();
        $this->respond(200, true, 'Merci ' . $data['prenom'] . ' ! Votre demande est bien partie. Nous revenons vers vous sous 48 h.');
    }

    /* ================================================================
       Validation
       ================================================================ */
    /** @return array{0: array<string,string>, 1: array<string,string>} */
    private function validate(array $in): array
    {
        $clean = static function ($v, int $max): string {
            $v = is_string($v) ? $v : '';
            if (!mb_check_encoding($v, 'UTF-8')) {
                $v = '';
            }
            // Supprime les caractères de contrôle (hors retours à la ligne)
            $v = preg_replace('/[^\P{C}\n\t]/u', '', $v) ?? '';
            $v = trim(str_replace(["\r\n", "\r"], "\n", $v));
            return mb_substr($v, 0, $max);
        };
        $oneLine = static fn(string $v): string => trim(preg_replace('/\s+/u', ' ', $v) ?? '');

        $d = [
            'solution' => $oneLine($clean($in['solution'] ?? '', 40)),
            'prenom'   => $oneLine($clean($in['prenom'] ?? '', 80)),
            'nom'      => $oneLine($clean($in['nom'] ?? '', 80)),
            'tel'      => $oneLine($clean($in['tel'] ?? '', 30)),
            'email'    => $oneLine($clean($in['email'] ?? '', 254)),
            'message'  => $clean($in['message'] ?? '', 5000),
            'rgpd'     => (string)($in['rgpd'] ?? ''),
        ];
        $e = [];

        if ($d['solution'] !== '' && !in_array($d['solution'], self::SOLUTIONS, true)) {
            $d['solution'] = '';
        }
        $namePattern = '/^[\p{L}\p{M}][\p{L}\p{M}\' .-]{0,79}$/u';
        if ($d['prenom'] === '' || !preg_match($namePattern, $d['prenom'])) {
            $e['prenom'] = 'Indiquez votre prénom.';
        }
        if ($d['nom'] === '' || !preg_match($namePattern, $d['nom'])) {
            $e['nom'] = 'Indiquez votre nom.';
        }
        $digits = preg_replace('/\D/', '', $d['tel']) ?? '';
        if (!preg_match('/^[0-9+().\s-]{6,30}$/', $d['tel']) || strlen($digits) < 6 || strlen($digits) > 15) {
            $e['tel'] = 'Indiquez un numéro de téléphone valide.';
        }
        if (!filter_var($d['email'], FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n,;<>"]/', $d['email'])) {
            $e['email'] = 'Indiquez une adresse e-mail valide.';
        }
        $len = mb_strlen($d['message']);
        if ($len < 10) {
            $e['message'] = 'Votre message doit contenir au moins 10 caractères.';
        } elseif (preg_match_all('~(https?://|www\.)~i', $d['message']) > (int)$this->cfg['max_links']) {
            $e['message'] = 'Votre message contient trop de liens.';
        }
        if (!in_array($d['rgpd'], ['on', '1', 'true'], true)) {
            $e['rgpd'] = 'Merci d\'accepter le traitement de vos données.';
        }
        return [$d, $e];
    }

    /* ================================================================
       Envoi
       ================================================================ */
    private function sendNotification(array $d): void
    {
        $subject = trim($this->cfg['subject_prefix'] . ' Nouvelle demande de ' . $d['prenom'] . ' ' . $d['nom']
            . ($d['solution'] !== '' ? ' · ' . $d['solution'] : ''));

        $rows = [
            'Solution'  => $d['solution'] !== '' ? $d['solution'] : 'Non précisée',
            'Prénom'    => $d['prenom'],
            'Nom'       => $d['nom'],
            'Téléphone' => $d['tel'],
            'E-mail'    => $d['email'],
        ];
        $date = (new DateTimeImmutable('now', new DateTimeZone('Europe/Paris')))->format('d/m/Y à H:i');

        $text = "Nouvelle demande reçue depuis le site, le $date.\n\n";
        foreach ($rows as $k => $v) {
            $text .= $k . str_repeat(' ', max(1, 11 - mb_strlen($k))) . ': ' . $v . "\n";
        }
        $text .= "\nMessage :\n" . $d['message'] . "\n\n—\nRépondez directement à cet e-mail pour écrire à " . $d['prenom'] . ".\n";

        $h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $html = '<!doctype html><html lang="fr"><body style="margin:0;background:#EEF1FF;font-family:Arial,Helvetica,sans-serif;color:#11131C">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">'
            . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden">'
            . '<tr><td style="background:#2D4EF5;color:#fff;padding:22px 28px;font-size:20px;font-weight:bold">Nouvelle demande de contact</td></tr>'
            . '<tr><td style="padding:24px 28px"><p style="margin:0 0 16px;color:#5B6178;font-size:14px">Reçue le ' . $h($date) . '</p>'
            . '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px">';
        foreach ($rows as $k => $v) {
            $val = $h($v);
            if ($k === 'E-mail') {
                $val = '<a href="mailto:' . $h($v) . '" style="color:#2D4EF5">' . $val . '</a>';
            } elseif ($k === 'Téléphone') {
                $val = '<a href="tel:' . $h(preg_replace('/[^0-9+]/', '', $v) ?? '') . '" style="color:#2D4EF5">' . $val . '</a>';
            }
            $html .= '<tr><td style="padding:6px 12px 6px 0;color:#5B6178;white-space:nowrap;vertical-align:top">' . $h($k) . '</td><td style="padding:6px 0;font-weight:bold">' . $val . '</td></tr>';
        }
        $html .= '</table><div style="margin-top:20px;padding:16px 18px;background:#F5F7FF;border-radius:12px;font-size:15px;line-height:1.6">'
            . nl2br($h($d['message'])) . '</div>'
            . '<p style="margin:20px 0 0;font-size:13px;color:#5B6178">Répondez directement à cet e-mail pour écrire à ' . $h($d['prenom']) . '.</p>'
            . '</td></tr></table></td></tr></table></body></html>';

        $this->deliver(
            to: (string)$this->cfg['to'],
            toName: (string)($this->cfg['to_name'] ?? ''),
            subject: $subject,
            text: $text,
            html: $html,
            replyTo: $d['email'],
            replyName: $d['prenom'] . ' ' . $d['nom'],
        );
    }

    private function sendAcknowledgement(array $d): void
    {
        $text = "Bonjour " . $d['prenom'] . ",\n\nNous avons bien reçu votre demande et revenons vers vous sous 48 h.\n\n"
            . "Pour rappel, votre message :\n" . $d['message'] . "\n\nL'équipe Nouvelle Version";
        $h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $html = '<!doctype html><html lang="fr"><body style="font-family:Arial,Helvetica,sans-serif;color:#11131C">'
            . '<p>Bonjour ' . $h($d['prenom']) . ',</p><p>Nous avons bien reçu votre demande et revenons vers vous sous 48 h.</p>'
            . '<p style="color:#5B6178">Pour rappel, votre message :</p><blockquote style="margin:0;padding:12px 16px;background:#F5F7FF;border-radius:8px">'
            . nl2br($h($d['message'])) . '</blockquote><p>L\'équipe Nouvelle Version</p></body></html>';
        $this->deliver(
            to: $d['email'],
            toName: $d['prenom'] . ' ' . $d['nom'],
            subject: (string)$this->cfg['subject_prefix'] . ' Nous avons bien reçu votre demande',
            text: $text,
            html: $html,
            replyTo: (string)$this->cfg['to'],
            replyName: (string)($this->cfg['to_name'] ?? ''),
        );
    }

    private function deliver(string $to, string $toName, string $subject, string $text, string $html, string $replyTo, string $replyName): void
    {
        $from     = (string)$this->cfg['from'];
        $fromName = (string)($this->cfg['from_name'] ?? '');
        foreach ([$to, $from, $replyTo] as $addr) {
            if (!filter_var($addr, FILTER_VALIDATE_EMAIL)) {
                throw new RuntimeException('Adresse invalide dans la configuration ou le formulaire');
            }
        }

        $boundary = 'nv_' . bin2hex(random_bytes(12));
        $domain   = substr(strrchr($from, '@') ?: '@localhost', 1);
        $headers  = [
            'From: ' . $this->formatAddress($from, $fromName),
            'Reply-To: ' . $this->formatAddress($replyTo, $replyName),
            'Date: ' . date(DATE_RFC2822),
            'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            'X-Auto-Response-Suppress: OOF, AutoReply',
        ];
        $body = "--$boundary\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text)) . "\r\n"
            . "--$boundary\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html)) . "\r\n"
            . "--$boundary--\r\n";
        $encSubject = $this->encodeHeader($subject);

        if (($this->cfg['transport'] ?? 'mail') === 'smtp') {
            $data = implode("\r\n", array_merge($headers, [
                'To: ' . $this->formatAddress($to, $toName),
                'Subject: ' . $encSubject,
            ])) . "\r\n\r\n" . $body;
            (new SmtpMailer((array)$this->cfg['smtp']))->send($from, [$to], $data);
            return;
        }

        // mail() : -f fixe l'expéditeur d'enveloppe (indispensable pour SPF)
        $ok = mail(
            $this->formatAddress($to, $toName),
            $encSubject,
            $body,
            implode("\r\n", $headers),
            '-f' . $from
        );
        if (!$ok) {
            throw new RuntimeException('mail() a renvoyé false');
        }
    }

    private function formatAddress(string $email, string $name): string
    {
        $name = trim(preg_replace('/[\r\n"<>]/', '', $name) ?? '');
        return $name === '' ? $email : $this->encodeHeader($name) . ' <' . $email . '>';
    }

    private function encodeHeader(string $value): string
    {
        $value = preg_replace('/[\r\n]+/', ' ', $value) ?? '';
        return preg_match('/[^\x20-\x7E]/', $value)
            ? '=?UTF-8?B?' . base64_encode($value) . '?='
            : $value;
    }

    /* ================================================================
       Jeton anti-robot (sans session) : horodatage signé HMAC
       ================================================================ */
    private function issueToken(): string
    {
        $ts    = (string)time();
        $nonce = bin2hex(random_bytes(8));
        return $ts . '.' . $nonce . '.' . hash_hmac('sha256', "nv-contact|$ts|$nonce", $this->secret);
    }

    private function tokenValid(string $token, ?string &$error): bool
    {
        $error = 'Session expirée : rechargez la page puis renvoyez le formulaire.';
        if (!preg_match('/^(\d{10})\.([a-f0-9]{16})\.([a-f0-9]{64})$/', $token, $m)) {
            return false;
        }
        [, $ts, $nonce, $sig] = $m;
        if (!hash_equals(hash_hmac('sha256', "nv-contact|$ts|$nonce", $this->secret), $sig)) {
            return false;
        }
        $age = time() - (int)$ts;
        if ($age > (int)$this->cfg['token_ttl']) {
            return false;
        }
        if ($age < (int)$this->cfg['min_fill_seconds']) {
            $error = 'Envoi trop rapide : patientez quelques secondes puis réessayez.';
            return false;
        }
        // Un jeton ne sert qu'une fois
        $used = $this->storage . '/tokens/' . $nonce;
        if (is_file($used)) {
            $error = 'Ce formulaire a déjà été envoyé.';
            return false;
        }
        @touch($used);
        $this->cleanup($this->storage . '/tokens', (int)$this->cfg['token_ttl'] + 60);
        return true;
    }

    /* ================================================================
       Limitation de débit (fichiers, compatible hébergement mutualisé)
       ================================================================ */
    private function visitorKey(): string
    {
        return hash_hmac('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), $this->secret);
    }

    private function rateLimitOk(): bool
    {
        $now    = time();
        $window = (int)$this->cfg['rate_limit']['window'];
        $max    = (int)$this->cfg['rate_limit']['max'];

        $mine = $this->readStamps($this->storage . '/ratelimit/' . $this->visitorKey(), $now - $window);
        if (count($mine) >= $max) {
            return false;
        }
        $all = $this->readStamps($this->storage . '/ratelimit/_global', $now - 86400);
        return count($all) < (int)$this->cfg['daily_cap'];
    }

    private function recordSend(): void
    {
        $now = time();
        $this->appendStamp($this->storage . '/ratelimit/' . $this->visitorKey(), $now, $now - (int)$this->cfg['rate_limit']['window']);
        $this->appendStamp($this->storage . '/ratelimit/_global', $now, $now - 86400);
        $this->cleanup($this->storage . '/ratelimit', 86400 * 2);
    }

    /** @return int[] */
    private function readStamps(string $file, int $since): array
    {
        if (!is_file($file)) {
            return [];
        }
        $raw = (string)@file_get_contents($file);
        return array_values(array_filter(array_map('intval', explode(',', $raw)), static fn(int $t) => $t > $since));
    }

    private function appendStamp(string $file, int $now, int $since): void
    {
        $fh = @fopen($file, 'c+');
        if (!$fh) {
            return;
        }
        if (flock($fh, LOCK_EX)) {
            $raw    = stream_get_contents($fh) ?: '';
            $stamps = array_filter(array_map('intval', explode(',', $raw)), static fn(int $t) => $t > $since);
            $stamps[] = $now;
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, implode(',', $stamps));
            fflush($fh);
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    }

    /* ================================================================
       Origine de la requête
       ================================================================ */
    private function originAllowed(): bool
    {
        $allowed = array_map('strtolower', (array)($this->cfg['allowed_hosts'] ?? []));
        $current = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')) ?? '');
        if ($current !== '') {
            $allowed[] = $current;
        }
        $source = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
        if ($source === '' || $source === 'null') {
            return false;
        }
        $host = strtolower((string)parse_url($source, PHP_URL_HOST));
        return $host !== '' && in_array($host, $allowed, true);
    }

    /* ================================================================
       Réponses
       ================================================================ */
    private function wantsJson(): bool
    {
        return str_contains((string)($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json')
            || ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch';
    }

    private function respond(int $status, bool $ok, string $message, array $errors = []): never
    {
        if ($this->wantsJson()) {
            $this->json($status, ['ok' => $ok, 'message' => $message, 'errors' => (object)$errors]);
        }
        // Repli sans JavaScript : retour sur la page avec un statut
        $back = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/\\') . '/';
        header('Location: ' . $back . '?contact=' . ($ok ? 'ok' : 'erreur') . '#contact', true, 303);
        exit;
    }

    private function json(int $status, array $payload): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    private function baseHeaders(): void
    {
        header('Cache-Control: no-store, max-age=0');
        header('X-Content-Type-Options: nosniff');
        header('X-Robots-Tag: noindex, nofollow');
        header_remove('X-Powered-By');
    }

    /* ================================================================
       Stockage technique (app/storage, interdit au public)
       ================================================================ */
    private function ensureStorage(): void
    {
        foreach (['', '/ratelimit', '/tokens', '/logs'] as $dir) {
            $path = $this->storage . $dir;
            if (!is_dir($path)) {
                @mkdir($path, 0700, true);
            }
        }
        $guard = $this->storage . '/.htaccess';
        if (!is_file($guard)) {
            @file_put_contents($guard, "Require all denied\n");
        }
    }

    private function loadSecret(): string
    {
        $configured = (string)($this->cfg['secret'] ?? '');
        if (strlen($configured) >= 32) {
            return $configured;
        }
        $file = $this->storage . '/secret.key';
        $key  = is_file($file) ? trim((string)file_get_contents($file)) : '';
        if (strlen($key) < 32) {
            $key = bin2hex(random_bytes(32));
            if (@file_put_contents($file, $key, LOCK_EX) === false) {
                throw new RuntimeException('Impossible d\'écrire app/storage/secret.key');
            }
            @chmod($file, 0600);
        }
        return $key;
    }

    private function cleanup(string $dir, int $maxAge): void
    {
        if (random_int(1, 20) !== 1) {
            return; // nettoyage occasionnel
        }
        foreach (glob($dir . '/*') ?: [] as $f) {
            if (is_file($f) && filemtime($f) < time() - $maxAge) {
                @unlink($f);
            }
        }
    }

    private function log(string $message): void
    {
        $line = '[' . date('c') . '] ' . preg_replace('/[\r\n]+/', ' ', $message) . "\n";
        @file_put_contents($this->storage . '/logs/contact.log', $line, FILE_APPEND | LOCK_EX);
    }
}
