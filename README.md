# LinkedIn Auto Apply Bot 🤖

Un bot intelligent qui automatise les candidatures LinkedIn "Easy Apply" en utilisant Playwright pour la navigation et OpenAI pour répondre aux questions des recruteurs.

## Fonctionnalités

- **Navigation Réaliste** : Utilise un vrai navigateur (Chromium) en mode visuel pour éviter la détection.
- **Réponses Intelligentes** : Analyse les questions des formulaires (années d'expérience, visa, etc.) et génère des réponses basées sur votre profil via GPT.
- **Filtre Easy Apply** : Cible uniquement les offres à candidature simplifiée.
- **Session Persistante** : Une seule connexion manuelle requise.

## Prérequis

- Node.js (v14+)
- Clé API OpenAI
- Compte LinkedIn

## Installation

1. Cloner le repo et installer les dépendances :
   ```bash
   npm install
   npx playwright install
   ```

2. Configurer les variables d'environnement :
   Créez un fichier `.env` à la racine :
   ```env
   OPENAI_API_KEY=sk-votre-cle-api-openai
   SEARCH_KEYWORDS=Développeur React
   SEARCH_LOCATION=Paris, France
   HEADLESS=false
   ```

3. Configurer votre profil :
   Éditez le fichier `user-data/profile.json` avec vos vraies informations. C'est ce que l'IA utilisera pour répondre.

## Utilisation

### 1. Première Connexion (Obligatoire)

Lancez le script de connexion pour sauvegarder votre session :

```bash
npm run login
```

Une fenêtre s'ouvrira. Connectez-vous manuellement à LinkedIn. Une fois sur votre fil d'actualité, le script détectera la connexion, sauvegardera le fichier `user-data/auth.json` et se fermera.

### 2. Lancer l'Automatisation

Une fois connecté :

```bash
npm start
```

Le bot va :
1. Ouvrir LinkedIn.
2. Chercher les offres selon vos mots-clés.
3. Tenter de postuler aux offres "Easy Apply".
4. Remplir les formulaires intelligemment.

## Avertissement

L'utilisation de bots sur LinkedIn peut enfreindre les conditions d'utilisation. Utilisez ce script de manière responsable et à une fréquence raisonnable pour éviter le blocage de votre compte.

