# CinéMatch

Application Ionic React de découverte de films et de rencontres entre cinéphiles.

## Fonctionnalités

- Création de comptes locaux avec profil, mot de passe et photo.
- Catalogue de départ, playlist de favoris et ajout de films au catalogue local.
- Le premier compte local créé est administrateur : il peut ajouter des films et désactiver/réactiver les autres comptes sans les supprimer.
- Suggestions de profils enregistrés sur le même appareil lorsque le score de compatibilité est supérieur à 75 %.
- Score pondéré : films identiques (40 %), genres (30 %), acteurs (20 %) et proximité des années de sortie (10 %).
- Comptes, favoris et catalogue enregistrés avec Capacitor Preferences (SharedPreferences sur Android/iOS, stockage local sur le Web). Les photos sont conservées séparément dans IndexedDB afin de ne pas encombrer les préférences.
- Prise de photo avec Capacitor Camera. Sur le Web, les composants PWA Elements affichent l’interface caméra; un sélecteur de fichier reste disponible comme solution de remplacement.

## Démarrage Web

Prérequis : Node.js 20 ou supérieur et la CLI Ionic.

```sh
npm install
npm install -g @ionic/cli
ionic serve
```

Le serveur s’ouvre sur `http://localhost:8100`. Pour que la caméra Web soit accessible hors de `localhost`, le site doit être servi en HTTPS et l’utilisateur doit autoriser l’accès à la caméra. Le bouton de sélection d’image fonctionne aussi sur ordinateur et sur mobile.

Pour générer la version Web de production : `npm run build`.

## Capacitor natif

Le projet inclut Capacitor Core, Camera, Preferences et sa configuration. Ajoutez la plateforme souhaitée, puis synchronisez les plugins :

```sh
npx cap add android
npx cap sync
```

Remplacez `android` par `ios` pour une cible iOS et ouvrez ensuite le projet natif avec l’outil de la plateforme.

## Limites du mode local

- Aucun service Firebase ou serveur distant n’est utilisé. Les comptes, mots de passe, profils, photos et favoris restent sur l’appareil/navigateur courant; ils ne sont ni partagés ni synchronisés.
- Les données du navigateur et celles de l’application native sont distinctes. Effacer les données du navigateur ou désinstaller l’application peut supprimer les comptes et les favoris locaux.
- Les comptes locaux servent à tester l’application sur un appareil partagé; ils ne remplacent pas une authentification sécurisée pour un service en ligne.
- Les rôles administrateur sont eux aussi locaux. Ce mode convient à une démonstration sur un appareil, pas à une administration sécurisée contre des utilisateurs capables de modifier les données locales.
- Les affiches de départ sont des images distantes de démonstration.
