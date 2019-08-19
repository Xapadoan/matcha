# Matcha
42 Projects

**N'oublie pas de supprimer le .git ignore et de mettre a jour les fichiers de configuration avant de push.**

#### Trucs a faire :
- Terminer memberManager.updateUser
- Securisation des images uploadés
- Protection contre injection html/js
- **Du front quoi, ça ressemble a rien la** (mais a la toute fin)

Pour cette version, on essaye de faire marcher la creation d'utilisateurs

## Required packages

Le dossier node_modules n'est pas à jour sur cette branche, verifiez que touts les packages suivants soient bien installés:
- express
- mysql
- csurf
- bcrypt
- nodemailer
- uniqid

## Ejs files

Les fichiers .ejs sont toujours chargés depuis `/views` regarde `/views/head.ejs` !

## Css Files

Les fichiers CSS sont chargés depuis `/resources` avec [express.static](https://expressjs.com/en/starter/static-files.html)

## JSON Files

Les fichiers de config sont les .json.

 - database.json
 - server_settings.json
 - mail_data.json
