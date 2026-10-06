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

Le formulaire de contact n’envoie rien pour l’instant : il reste à le brancher sur un service d’envoi.

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

