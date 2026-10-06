<?php
/**
 * Page 404 servie par le .htaccess pour toute URL inexistante.
 * Ajoute une balise <base> pour que les liens restent justes, que le site
 * soit à la racine du domaine ou dans un sous-dossier.
 */
declare(strict_types=1);

http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';
$html = (string)file_get_contents(__DIR__ . '/404.html');
echo preg_replace('/<head>/i', '<head>' . "\n" . '<base href="' . htmlspecialchars($base, ENT_QUOTES, 'UTF-8') . '">', $html, 1);
