<?php
/**
 * Nouvelle Version · point d'entrée du formulaire de contact
 *   GET  contact.php?action=token  -> jeton anti-robot (JSON)
 *   POST contact.php               -> envoi de la demande
 */
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

$config = require __DIR__ . '/app/config.php';
$local  = __DIR__ . '/app/config.local.php';
if (is_file($local)) {
    $config = array_replace_recursive($config, (array)require $local);
}

require __DIR__ . '/app/ContactHandler.php';

try {
    (new ContactHandler($config))->run();
} catch (Throwable $e) {
    error_log('[contact] ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => false, 'message' => 'Le service d\'envoi est momentanément indisponible.'], JSON_UNESCAPED_UNICODE);
}
