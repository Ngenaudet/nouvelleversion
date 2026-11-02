# Nouvelle Version

Site statique de l’agence Nouvelle Version : HTML, CSS, JavaScript et animations GSAP. Les polices et bibliothèques sont auto-hébergées.

## Pages

- `index.html` : accueil et formulaire Zite intégré (`https://xqpzdcc8fe.zite.so`).
- `mentions-legales.html`, `politique-de-confidentialite.html`, `conditions-generales.html` : pages accessibles depuis le pied de page, sans JavaScript.
- `404.html` : page d’erreur statique.

Les pages d’information sont en `noindex` tant que leurs contenus ne sont pas finalisés. Compléter l’identité juridique de l’éditeur, l’adresse, l’immatriculation, le directeur de publication, les coordonnées de l’hébergeur, les conditions contractuelles et les paramètres réels de traitement des données dans Zite avant de les considérer comme définitives.

## Contact

Le traitement, les notifications et la confirmation du formulaire sont configurés dans Zite. Aucun backend PHP ni configuration SMTP n’est nécessaire.

## Hébergement Apache

Déployer les fichiers statiques et le `.htaccess`, puis activer le certificat HTTPS. Le domaine utilisé dans les métadonnées est `nouvelleversion.fr`.

Le `.htaccess` configure HTTPS, les en-têtes de sécurité, la compression, le cache et `ErrorDocument 404 /404.html`. La CSP autorise le domaine du formulaire Zite.

Pour une installation dans un sous-dossier, adapter `ErrorDocument` dans `.htaccess` et le `<base href="/">` de `404.html` au chemin d’installation (par exemple `/site/404.html` et `/site/`).

Lors d’une mise à jour du site existant, supprimer également du serveur les anciens fichiers `contact.php`, `404.php` et le dossier `app/` : un simple transfert FTP ne supprime pas les fichiers obsolètes.

Après modification des styles ou scripts, incrémenter leur paramètre `?v=` dans les pages concernées.

En cas d’erreur Apache « Server unable to read htaccess file », vérifier les droits des dossiers (755), des fichiers (644) et les permissions des dossiers parents avec l’hébergeur.
