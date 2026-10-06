<?php
/**
 * Nouvelle Version · configuration du formulaire de contact
 *
 * Ce fichier ne contient aucun secret : il peut être versionné.
 * Les valeurs sensibles (mot de passe SMTP…) vont dans app/config.local.php,
 * qui n'est pas versionné et qui écrase les valeurs ci-dessous.
 * Modèle : app/config.local.sample.php
 */
return [
    // Destinataire des demandes
    'to'        => 'nouvelle-version@mail.com',
    'to_name'   => 'Nouvelle Version',

    // Expéditeur technique : une adresse qui existe sur VOTRE domaine
    // (à créer dans cPanel o2switch > Comptes de messagerie), sinon les
    // messages risquent de finir en spam (SPF / DKIM).
    'from'      => 'no-reply@nouvelle-version.fr',
    'from_name' => 'Site Nouvelle Version',

    'subject_prefix' => '[Nouvelle Version]',

    // 'mail' : fonction mail() de PHP (fonctionne directement sur o2switch)
    // 'smtp' : envoi authentifié via une boîte mail o2switch (meilleure délivrabilité)
    'transport' => 'mail',

    'smtp' => [
        'host'       => '',      // ex. 'mail.nouvelle-version.fr' ou le nom du serveur o2switch
        'port'       => 465,     // 465 = SSL, 587 = STARTTLS
        'encryption' => 'ssl',   // 'ssl' ou 'tls'
        'username'   => '',      // adresse complète de la boîte
        'password'   => '',      // à renseigner dans config.local.php
        'timeout'    => 15,
    ],

    // Envoyer un accusé de réception au visiteur (désactivé par défaut)
    'send_copy_to_visitor' => false,

    // Noms d'hôte autorisés à poster le formulaire. Vide = hôte courant uniquement.
    'allowed_hosts' => [],

    // Anti-abus
    'rate_limit'       => ['max' => 5, 'window' => 3600], // 5 envois / heure / visiteur
    'daily_cap'        => 150,                            // plafond global / 24 h
    'min_fill_seconds' => 3,                              // un humain met plus de 3 s
    'token_ttl'        => 7200,                           // jeton valable 2 h
    'max_links'        => 3,                              // liens max dans le message

    // Clé secrète (signature des jetons, anonymisation des IP).
    // Laisser vide : elle est générée automatiquement dans app/storage/secret.key
    'secret' => '',
];
