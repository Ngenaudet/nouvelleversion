# Nouvelle Version

Site de l’agence **Nouvelle Version**, réalisé à partir de la maquette créée par **David**.

## Technologies

- HTML et CSS pour un site statique.
- JavaScript et GSAP pour les animations.

## État du projet

La page d’accueil est intégrée (`index.html`, styles dans `css/style.css`) :

- Hero, offres (cartes en verre), méthode en cartes sticky, CTA, à propos, équipe, contact, FAQ, footer.
- SEO : balises meta, Open Graph, données structurées JSON-LD (ProfessionalService + FAQPage).
- Animations GSAP + ScrollTrigger, désactivées si l’utilisateur demande moins d’animations.
- Images optimisées en WebP dans `images/`, sources d’origine dans `assets/`.

Le formulaire de contact envoie les demandes par e-mail via PHP (`contact.php`).

## Sécurité et hébergement

Le site est prévu pour un hébergement Apache (`.htaccess`) :

- redirection HTTPS et domaine canonique `www.nouvelle-version.fr` (à adapter) ;
- en-têtes de sécurité : HSTS, Content-Security-Policy stricte, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP ;
- blocage des fichiers sensibles (`.git`, `.env`, `.md`, archives…), du dossier `assets/` et du listing des dossiers ;
- méthodes HTTP limitées à GET, HEAD et POST, filtrage des requêtes malveillantes courantes ;
- compression Brotli/Gzip et cache navigateur ;
- page `404.html`, `robots.txt`, `sitemap.xml`, `.well-known/security.txt`.

Tout est auto-hébergé (polices dans `fonts/`, GSAP dans `js/vendor/`) : aucun appel à un service tiers, ce qui permet une CSP sans `unsafe-inline` et évite le transfert de l’IP des visiteurs à Google (RGPD).

Après une modification de `css/style.css` ou `js/main.js`, incrémentez le paramètre `?v=` dans `index.html` pour forcer le rafraîchissement du cache.

## Formulaire de contact (PHP)

Prérequis : PHP 8.1 ou plus (sélectionnable dans cPanel o2switch › Sélectionner une version de PHP).

| Fichier | Rôle |
| --- | --- |
| `contact.php` | Point d’entrée public : délivre le jeton anti-robot (GET) et traite l’envoi (POST). |
| `app/ContactHandler.php` | Validation, sécurité, mise en forme et envoi du message. |
| `app/SmtpMailer.php` | Envoi SMTP authentifié (optionnel). |
| `app/config.php` | Réglages (destinataire, expéditeur, limites). Versionné, sans secret. |
| `app/config.local.php` | Surcharges privées (mot de passe SMTP). **Non versionné**, à créer sur le serveur depuis `config.local.sample.php`. |
| `app/storage/` | Créé automatiquement : clé secrète, limitation de débit, journaux. Non versionné, interdit au public. |
| `404.php` | Page 404 avec le bon statut HTTP, quel que soit le dossier d’installation. |

Protections : POST uniquement, contrôle de l’origine, jeton signé à usage unique avec délai minimal de 3 s, champ piège invisible, 5 envois par heure et par visiteur (IP anonymisée) et 150 par jour au total, validation stricte de chaque champ, protection contre l’injection d’en-têtes, limite de taille, message HTML échappé.

### Mise en ligne sur o2switch

1. Envoyez tout le dépôt dans le dossier voulu (FTP ou Git Version Control de cPanel). Le site fonctionne à la racine d’un domaine comme dans un sous-dossier.
2. Dans cPanel › Comptes de messagerie, créez l’adresse d’expédition (par ex. `no-reply@votre-domaine.fr`) et reportez-la dans `'from'` de `app/config.php`. Elle doit appartenir au domaine du site, sinon les messages partent en spam.
3. Vérifiez `'to'` (adresse qui reçoit les demandes).
4. Activez le certificat SSL (AutoSSL / Let’s Encrypt) : le `.htaccess` force le HTTPS.
5. Testez le formulaire. Les erreurs d’envoi sont consignées dans `app/storage/logs/contact.log`.

Par défaut l’envoi utilise `mail()`, qui fonctionne directement sur o2switch. Pour une délivrabilité maximale, passez en SMTP : copiez `app/config.local.sample.php` en `app/config.local.php` et renseignez l’hôte, l’adresse et le mot de passe de la boîte d’expédition.

