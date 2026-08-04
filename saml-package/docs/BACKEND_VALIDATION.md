# Backend Validation - Complete Guide

## Overview

La **validation backend** permet à votre serveur de valider les assertions SAML reçues du client Electron.

### Flux Complet

```
1. IdP → Electron   : SAML Assertion (encodée en base64)
   ↓
2. Electron → Backend : POST /api/saml/validate
   {
     "assertion": "<?xml...raw SAML XML...?>",
     "user": { "name": "John", "email": "john@example.com" }
   }
   ↓
3. Backend : Valider signature, vérifier user, générer session
   ↓
4. Backend → Electron : XML Response
   <?xml version="1.0"?>
   <response>
     <success>true</success>
     <user>
       <name>John</name>
       <email>john@example.com</email>
     </user>
     <config>
       <session_id>...</session_id>
       <role>admin</role>
     </config>
   </response>
   ↓
5. Electron : Reçoit les données validées
   Appelle onSuccess(result) avec user + config
```

## Configuration

### 1. Dans `~/.config/CelyaVox/sso.ini`

```ini
[SAML]
metadataUrl=https://your-idp.com/metadata.xml
issuer=urn:your-app:id
callbackUrl=http://localhost:3001/auth/saml/callback

# AJOUT: URL de validation backend
validateUrl=https://your-backend.com/api/saml/validate
```

### 2. La fonction appelée automatiquement

Dans `src/saml-client.ts`, lors du callback SAML:

```typescript
if (samlValidateUrl && currentSAMLAssertion) {
  // Appel automatique à votre API
  const result = await validateSAMLViaAPI(
    serializedUser,
    currentSAMLAssertion,
    samlValidateUrl
  );
  
  // Envoi du résultat à l'app
  mainWindow.webContents.send('auth:saml-success', result);
}
```

## Implémentation Backend

### Option 1: PHP (Recommandé pour projet existant)

Voir: [backend-validation.php](backend-validation.php)

Étapes principales:
1. Recevoir POST request avec assertion + user
2. Parser l'assertion XML
3. Vérifier la signature (optionnel)
4. Valider l'utilisateur
5. Générer un session token
6. Retourner XML response

```php
<?php
// Recevoir données
$data = json_decode(file_get_contents('php://input'), true);
$assertion = $data['assertion'];
$user = $data['user'];

// Parser et valider
$dom = new DOMDocument();
$dom->loadXML($assertion);

// Vérifier utilisateur dans base de données
$email = $user['email'];
$authorized = checkUserInDatabase($email);

if ($authorized) {
  // Générer session
  $sessionId = generateSessionToken();
  
  // Retourner succès
  echo xmlSuccess([
    'user' => $user,
    'config' => [
      'session_id' => $sessionId,
      'role' => 'admin'
    ]
  ]);
} else {
  echo xmlError('User not authorized');
}
?>
```

### Option 2: Node.js/Express

Voir: [example-backend-validation.ts](example-backend-validation.ts) (section middleware)

```typescript
app.post('/api/saml/validate', async (req, res) => {
  const { assertion, user } = req.body;
  
  // Parser et valider SAML
  const parsed = await parseStringPromise(assertion);
  
  // Vérifier user
  const authorized = await checkUserInDatabase(user.email);
  
  if (!authorized) {
    return res.status(401).type('application/xml').send(`
      <?xml version="1.0"?>
      <response>
        <success>false</success>
        <error>User not authorized</error>
      </response>
    `);
  }
  
  // Succès
  res.type('application/xml').send(`
    <?xml version="1.0"?>
    <response>
      <success>true</success>
      <user>
        <name>${user.name}</name>
        <email>${user.email}</email>
      </user>
      <config>
        <session_id>xyz123</session_id>
      </config>
    </response>
  `);
});
```

### Option 3: Python/Flask

```python
from flask import Flask, request, Response
import xml.etree.ElementTree as ET

app = Flask(__name__)

@app.route('/api/saml/validate', methods=['POST'])
def validate_saml():
    data = request.get_json()
    assertion = data['assertion']
    user = data['user']
    
    # Parser l'assertion XML
    try:
        root = ET.fromstring(assertion)
    except ET.ParseError as e:
        return Response(
            '<?xml version="1.0"?><response><success>false</success>'
            '<error>Invalid XML</error></response>',
            mimetype='application/xml',
            status=400
        )
    
    # Vérifier utilisateur
    email = user['email']
    if not is_user_authorized(email):
        return Response(
            '<?xml version="1.0"?><response><success>false</success>'
            '<error>User not authorized</error></response>',
            mimetype='application/xml',
            status=401
        )
    
    # Succès
    response_xml = f'''<?xml version="1.0"?>
    <response>
      <success>true</success>
      <user>
        <name>{user['name']}</name>
        <email>{user['email']}</email>
      </user>
      <config>
        <session_id>xyz123</session_id>
        <role>admin</role>
      </config>
    </response>'''
    
    return Response(response_xml, mimetype='application/xml')
```

## Utilisation dans Electron

### Réception Automatique (Recommandé)

L'appel backend est **automatique**. Vous recevez simplement le résultat:

```typescript
const client = new SamlClient(config);

await client.initialize({
  onSuccess: (result) => {
    // result vient de votre backend!
    console.log('User:', result.user);      // { name, email }
    console.log('Config:', result.config);  // { session_id, role, ... }
    
    // Stocker session
    storeSession(result.config.session_id);
  },
  onError: (error) => {
    console.error('Validation failed:', error.message);
  },
});

await client.start();
shell.openExternal(client.getLoginURL());
```

### Appel Manuel (Avancé)

Si vous voulez valider manuellement:

```typescript
import { validateSAMLViaAPI } from './saml/src';

const result = await validateSAMLViaAPI(
  { name: 'John', email: 'john@example.com' },
  rawSAMLAssertion,
  'https://your-backend.com/api/saml/validate'
);

console.log('Validation result:', result);
// { success: true, user: {...}, config: {...} }
```

## Réponse Backend - Format XML

### Succès

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <success>true</success>
  <user>
    <name>John Doe</name>
    <email>john@example.com</email>
  </user>
  <config>
    <session_id>sess_abc123xyz</session_id>
    <role>admin</role>
    <department>IT</department>
    <features>dashboard,settings,api</features>
  </config>
</response>
```

### Erreur

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <success>false</success>
  <error>User not authorized</error>
</response>
```

## Étapes Backend Recommandées

### 1. Parser SAML Assertion

```php
$dom = new DOMDocument();
$dom->loadXML($assertion);
```

### 2. Vérifier Signature (Optionnel mais recommandé)

```php
// Installer: composer require robrichards/xmlseclibs
// Vérifier signature avec certificat IdP
```

### 3. Extraire Claims

```php
$xpath = new DOMXPath($dom);
$xpath->registerNamespace('saml', 'urn:oasis:names:tc:SAML:2.0:assertion');
$attributes = $xpath->query('//saml:Attribute');
```

### 4. Vérifier Utilisateur

```php
// Vérifier que l'email existe dans votre DB
$user = getUserByEmail($user['email']);
if (!$user || !$user['is_active']) {
  return error('User not found or inactive');
}
```

### 5. Checks d'Autorisation

```php
// Vérifier permissions, roles, etc.
if (!hasAccess($user['email'], $app)) {
  return error('User not authorized');
}
```

### 6. Générer Session

```php
$sessionId = generateSessionToken();
$sessionData = [
  'session_id' => $sessionId,
  'user_id' => $user['id'],
  'email' => $user['email'],
  'role' => $user['role'],
  'created_at' => time(),
  'expires_at' => time() + 3600,
];

// Stocker en DB ou cache (Redis)
storeSession($sessionData);
```

### 7. Retourner Réponse XML

```php
return xmlSuccess([
  'user' => ['name' => $user['name'], 'email' => $user['email']],
  'config' => [
    'session_id' => $sessionId,
    'role' => $user['role'],
    'department' => $user['department'],
  ],
]);
```

## Sécurité

### À Vérifier Absolument

1. **Signature SAML**
   - Vérifier la signature avec le certificat IdP
   - Utiliser xmldsigjs ou xmlseclibs
   - Empêcher les assertions non signées

2. **Timestamp**
   - Vérifier que l'assertion n'est pas expiree
   - Vérifier NotBefore et NotOnOrAfter

3. **Destinataire**
   - Vérifier que SubjectConfirmationData@Recipient = callbackUrl

4. **Emetteur**
   - Vérifier que Issuer = celui attendu

5. **User Authorization**
   - Vérifier que l'utilisateur existe
   - Vérifier qu'il a accès à l'app
   - Vérifier qu'il est actif

### HTTPS Requis en Production

- Toujours utiliser HTTPS en production
- Certificats valides
- Pas de certificats auto-signés

## Debugging

### Logs Backend

```php
error_log('[SAML] Validation request from: ' . $_SERVER['REMOTE_ADDR']);
error_log('[SAML] User: ' . $user['email']);
error_log('[SAML] Assertion length: ' . strlen($assertion));
error_log('[SAML] Validation result: ' . ($success ? 'OK' : 'FAILED'));
```

### Logs Electron

```bash
# Dans votre terminal
DEBUG=true npm run dev

# Ou dans le code
logger.info('Backend validation called');
logger.info('Response:', result);
```

### Test avec cURL

```bash
curl -X POST https://your-backend.com/api/saml/validate \
  -H "Content-Type: application/json" \
  -d '{
    "assertion": "<?xml...>",
    "user": {
      "name": "Test User",
      "email": "test@example.com"
    }
  }'
```

## Exemples Complets

### PHP
→ [backend-validation.php](backend-validation.php)

### Electron/TypeScript
→ [example-backend-validation.ts](example-backend-validation.ts)

### Configuration
→ [sso.ini.example](sso.ini.example)

## Questions Fréquentes

**Q: La validation est-elle obligatoire?**
A: Non, elle est optionnelle. Sans `validateUrl` configuré, l'app reçoit directement les données SAML.

**Q: Et si mon backend est lent?**
A: Augmentez le timeout (default: 10 secondes) dans `utils.ts`.

**Q: Comment stocker la session?**
A: En database ou cache (Redis). Retournez le session_id et vérifiez-le sur chaque requête.

**Q: Besoin de valider la signature?**
A: Recommandé en production. Utilisez xmldsigjs (Node.js) ou xmlseclibs (PHP).

**Q: Mon backend est en Python?**
A: Voir exemple Flask ci-dessus. Même flux pour Django, FastAPI, etc.

---

Pour plus d'informations: [INTEGRATION_GUIDE.md](../docs/INTEGRATION_GUIDE.md#intégration-du-backend-validation-saml)
