# Matcha
42 Projects

**N'oublie pas de supprimer le .git ignore et de mettre a jour les fichiers de configuration avant de push.**

#### Trucs a faire :

- Recherche:
    - Ajouter options de tri
- Gerer les matchs
    - Prendre en compte les interets
- Ajouter bad crsf error handler
- Ameliorer le chat:
    - front
    - sons ?
    - Envoi d'images ?
- Du front, on a bientot fini

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
- socket.io

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
