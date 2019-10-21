# Matcha
42 Projects

**N'oublie pas de supprimer le .git ignore et de mettre a jour les fichiers de configuration avant de push.**

#### Trucs a faire :

- Choper des icones:
    - poubelle
    - like
- Prendre en compte les relations pour le matchs
    - blocked
- Choper des sons:
    - claque
    - bisous
- Gerer les matchs
    - Prendre en compte les interets
    - Afficher la geolocalisation sous forme d'adresse si dans la bdd
- Autoriser l'utilisateur a supprimer ses photos
- Gestion des interets :
    - Les matchs, on passe a travers les interets de l'utilisateur, et on cherche dans la table interet les utilisateurs qui correspondent
    - Matcher en fonction de la geocalisation / fruit sexe = geo proche & fruit social = geo moyenne
- Gestion des autorisations
- Ajouter bad crsf error handler
- faire le chat
- Ameliorer la page perso
- Gerer les likes:
    - Afficher les comptes likes et likeurs
    - Envoyer notification
- notifications en temps reel

## Setup

#### users

id  | username | lastname | firstname | email | status | fruit | password
--- | -------- | -------- | --------- | ----- | ------ | ----- | --------
PRIMARY KEY | VARCHAR(100) | VARCHAR(100) | VARCHAR(100) | VARCHAR(255) | VARCHAR(100) | VARCHAR(20) | VARCHAR(255)

#### users_extended

id  | user | gender | orientation | age | bio | interests | lat | lng
--- | ---- | ------ | ----------- | --- | --- | --------- | --- | ---
PRIMARY KEY | FOREIGN KEY (users.id) | INT | VARCHAR(50) | INT | TEXT(500) | VARCHAR(255) | VARCHAR(20) | VARCHAR(20)

#### users_images

id  | user | image1 | image2 | image3 | image4 | image5
--- | ---- | ------ | ------ | ------ | ------ | ------
PRIMARY KEY | FOREIGN KEY (users.id) | VARCHAR(100) | VARCHAR(100) | VARCHAR(100) | VARCHAR(100) | VARCHAR(100)

#### users_interests

id  | name | user
--- | ---- | -----
PRIMARY KEY | VARCHAR(50) | INT

## Required packages

Le dossier node_modules n'est pas à jour sur cette branche, verifiez que touts les packages suivants soient bien installés:
- express
- express-session
- request
- ejs
- mysql
- csurf
- bcrypt
- nodemailer
- uniqid

## Ejs files

Les fichiers .ejs sont toujours chargés depuis `/views` regarde `/views/head.ejs` !

Les fichiers ejs previenne contre l'injection html et js, donc c'est bon, du moment qu'on utilise toujours `<%= variable %>`
pour afficher les variables.

## Css Files

Les fichiers CSS sont chargés depuis `/resources` avec [express.static](https://expressjs.com/en/starter/static-files.html)

## JSON Files

Les fichiers de config sont les .json.

 - database.json
 - server_settings.json
 - mail_data.json
