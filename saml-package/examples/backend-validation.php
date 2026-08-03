<?php
/**
 * SAML Backend Validation Example - PHP
 * 
 * This is your backend API that validates SAML assertions
 * from the Electron SAML client
 * 
 * Setup:
 * 1. Place this file at your endpoint (e.g., /api/saml/validate)
 * 2. Configure in Electron's ~/.config/celyavox/sso.ini:
 *    validateUrl=https://your-api.com/api/saml/validate
 * 3. Install required libraries: composer require robrichards/xmlseclibs
 */

// Enable CORS if needed
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/xml; charset=UTF-8');

// Log all SAML validation requests
error_log('[SAML Validation] ' . $_SERVER['REQUEST_METHOD'] . ' ' . $_SERVER['REQUEST_URI']);

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo xmlError('Invalid request method');
    exit;
}

// Get request body
$input = file_get_contents('php://input');
error_log('[SAML] Request received, size: ' . strlen($input) . ' bytes');

// Parse JSON payload
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo xmlError('Invalid JSON payload');
    exit;
}

// Extract assertion and user data
$assertion = $data['assertion'] ?? null;
$user = $data['user'] ?? null;

if (!$assertion || !$user) {
    http_response_code(400);
    echo xmlError('Missing assertion or user data');
    exit;
}

error_log('[SAML] User: ' . $user['email']);
error_log('[SAML] Assertion length: ' . strlen($assertion) . ' chars');

try {
    // ========================================================================
    // STEP 1: Parse SAML Assertion
    // ========================================================================
    
    error_log('[SAML] Parsing SAML assertion...');
    
    $dom = new DOMDocument();
    $dom->loadXML($assertion);
    
    if (!$dom) {
        throw new Exception('Failed to parse SAML assertion XML');
    }
    
    error_log('[SAML] SAML assertion parsed successfully');
    
    // ========================================================================
    // STEP 2: Verify SAML Signature (OPTIONAL)
    // ========================================================================
    
    // To verify signature, you need:
    // 1. Install: composer require robrichards/xmlseclibs
    // 2. Get IdP certificate
    // 3. Use XMLSecurityKey to verify
    
    // Example (requires xmlseclibs):
    /*
    require 'vendor/autoload.php';
    
    use RobRichards\XMLSecLibs\XMLSecurityKey;
    use RobRichards\XMLSecLibs\XMLSecurityDSig;
    
    $xpath = new DOMXPath($dom);
    $signatureNodes = $xpath->query('//ds:Signature', $dom->documentElement);
    
    if ($signatureNodes->length === 0) {
        throw new Exception('No signature found in SAML assertion');
    }
    
    $sig = new XMLSecurityDSig();
    $sig->locateSignature($dom);
    
    if (!$sig->validateReference()) {
        throw new Exception('SAML signature validation failed');
    }
    
    $key = $sig->getSignatureKey();
    if (!$key->isLoaded) {
        throw new Exception('Signature key not loaded');
    }
    
    error_log('[SAML] Signature verified successfully');
    */
    
    // ========================================================================
    // STEP 3: Extract User Claims
    // ========================================================================
    
    error_log('[SAML] Extracting user claims...');
    
    // Parse assertion to get claims
    $xpath = new DOMXPath($dom);
    
    // Register namespace
    $xpath->registerNamespace('saml', 'urn:oasis:names:tc:SAML:2.0:assertion');
    $xpath->registerNamespace('samlp', 'urn:oasis:names:tc:SAML:2.0:protocol');
    
    // Extract attributes
    $attributes = $xpath->query('//saml:Attribute');
    $claims = [];
    
    foreach ($attributes as $attr) {
        $name = $attr->getAttribute('Name');
        $values = $xpath->query('saml:AttributeValue', $attr);
        
        if ($values->length === 1) {
            $claims[$name] = $values->item(0)->nodeValue;
        } else {
            $claims[$name] = array_map(
                fn($v) => $v->nodeValue,
                iterator_to_array($values)
            );
        }
    }
    
    error_log('[SAML] Claims extracted: ' . json_encode($claims));
    
    // ========================================================================
    // STEP 4: Validate User Data
    // ========================================================================
    
    error_log('[SAML] Validating user data...');
    
    // Verify user email matches
    $email = $user['email'] ?? null;
    $name = $user['name'] ?? null;
    
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email: ' . $email);
    }
    
    error_log('[SAML] User validation successful: ' . $email);
    
    // ========================================================================
    // STEP 5: Authorization Checks
    // ========================================================================
    
    error_log('[SAML] Performing authorization checks...');
    
    // Check if user exists and is active in your system
    $isAuthorized = checkUserAuthorization($email);
    
    if (!$isAuthorized) {
        throw new Exception('User not authorized: ' . $email);
    }
    
    // Get user role/permissions
    $userRole = getUserRole($email);
    $userDept = getUserDepartment($email);
    
    error_log('[SAML] Authorization successful - Role: ' . $userRole);
    
    // ========================================================================
    // STEP 6: Generate Session
    // ========================================================================
    
    error_log('[SAML] Generating session token...');
    
    $sessionId = generateSessionToken($email);
    
    // Store session in database/cache
    storeSession([
        'session_id' => $sessionId,
        'email' => $email,
        'name' => $name,
        'role' => $userRole,
        'created_at' => time(),
        'expires_at' => time() + 3600, // 1 hour
    ]);
    
    error_log('[SAML] Session created: ' . $sessionId);
    
    // ========================================================================
    // STEP 7: Return Success Response
    // ========================================================================
    
    http_response_code(200);
    
    $response = xmlSuccess([
        'user' => [
            'name' => $name,
            'email' => $email,
        ],
        'config' => [
            'session_id' => $sessionId,
            'role' => $userRole,
            'department' => $userDept,
            'features' => implode(',', ['dashboard', 'settings', 'api']),
        ],
    ]);
    
    error_log('[SAML] Validation successful, returning response');
    
    echo $response;
    exit;

} catch (Exception $e) {
    
    error_log('[SAML] Validation failed: ' . $e->getMessage());
    
    http_response_code(401);
    echo xmlError($e->getMessage());
    exit;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user is authorized
 */
function checkUserAuthorization($email) {
    // TODO: Check against your database
    // Example:
    // SELECT COUNT(*) FROM users WHERE email = $email AND is_active = 1
    
    return true; // Allow all for now
}

/**
 * Get user role
 */
function getUserRole($email) {
    // TODO: Query from database
    return 'user'; // Default role
}

/**
 * Get user department
 */
function getUserDepartment($email) {
    // TODO: Query from database
    return 'Engineering'; // Default dept
}

/**
 * Generate session token
 */
function generateSessionToken($email) {
    return 'sess_' . bin2hex(random_bytes(16));
}

/**
 * Store session in database/cache
 */
function storeSession($sessionData) {
    // TODO: Store in database or cache (Redis)
    // Example:
    // $redis->setex(
    //     'session:' . $sessionData['session_id'],
    //     3600,
    //     json_encode($sessionData)
    // );
}

/**
 * Build success XML response
 */
function xmlSuccess($data) {
    $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><response/>');
    
    $xml->addChild('success', 'true');
    
    if (isset($data['user'])) {
        $userNode = $xml->addChild('user');
        foreach ($data['user'] as $key => $value) {
            $userNode->addChild($key, xmlEscape($value));
        }
    }
    
    if (isset($data['config'])) {
        $configNode = $xml->addChild('config');
        foreach ($data['config'] as $key => $value) {
            $configNode->addChild($key, xmlEscape($value));
        }
    }
    
    return $xml->asXML();
}

/**
 * Build error XML response
 */
function xmlError($message) {
    $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><response/>');
    $xml->addChild('success', 'false');
    $xml->addChild('error', xmlEscape($message));
    return $xml->asXML();
}

/**
 * Escape string for XML
 */
function xmlEscape($str) {
    return htmlspecialchars($str, ENT_XML1, 'UTF-8');
}

// ============================================================================
// MIDDLEWARE EXAMPLE - Express/Node.js
// ============================================================================

/*

If you prefer Node.js/Express instead of PHP:

import express from 'express';
import { parseStringPromise } from 'xml2js';

const app = express();
app.use(express.json());

app.post('/api/saml/validate', async (req, res) => {
  try {
    const { assertion, user } = req.body;
    
    // Parse SAML assertion
    const parsed = await parseStringPromise(assertion);
    
    // Verify signature (if needed)
    // const isValid = await verifySAMLSignature(parsed);
    
    // Check authorization
    const isAuthorized = await checkUserInDatabase(user.email);
    if (!isAuthorized) {
      return res.status(401).type('application/xml').send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <response>
          <success>false</success>
          <error>User not authorized</error>
        </response>
      `);
    }
    
    // Return success
    res.type('application/xml').send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <response>
        <success>true</success>
        <user>
          <name>${user.name}</name>
          <email>${user.email}</email>
        </user>
        <config>
          <role>user</role>
          <session_id>${generateSessionId()}</session_id>
        </config>
      </response>
    `);
  } catch (error) {
    res.status(500).type('application/xml').send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <response>
        <success>false</success>
        <error>${error.message}</error>
      </response>
    `);
  }
});

app.listen(3000);

*/
