<?php
declare(strict_types=1);
// LAN-only receiver at http://192.168.0.10/bmrmodz.php.
// No token. Firewall must block the webserver from the public Internet.
// Create ../bmrmodz_reports beside the web root; PHP needs write access.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function answer(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    answer(405, ['ok' => false, 'error' => 'Method not allowed']);
}
// Trust only the actual TCP peer, never proxy-provided X-Forwarded-For headers.
$remote = $_SERVER['REMOTE_ADDR'] ?? '';
$ip = filter_var($remote, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4);
if ($ip === false || !preg_match('/^192\\.168\\.0\\.(?:[0-9]{1,3})$/D', $ip)) {
    answer(403, ['ok' => false, 'error' => 'LAN access only']);
}
// Avoid writes to web-exposed storage, even if configuration is incorrect.
$webRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);
$storage = getenv('BMRMODZ_REPORT_DIR');
if (!is_string($storage) || $storage === '') {
    $storage = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bmrmodz_reports';
}
$directory = realpath($storage);
if ($directory === false || $webRoot === false || !is_dir($directory)
    || !is_writable($directory)
    || $directory === $webRoot
    || strpos($directory . DIRECTORY_SEPARATOR, rtrim($webRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR) === 0) {
    answer(503, ['ok' => false, 'error' => 'Private storage not configured']);
}
if (isset($_SERVER['CONTENT_TYPE']) && stripos($_SERVER['CONTENT_TYPE'], 'application/json') !== 0) {
    answer(415, ['ok' => false, 'error' => 'JSON required']);
}
if (isset($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > 32768) {
    answer(413, ['ok' => false, 'error' => 'Report too large']);
}
$stream = fopen('php://input', 'rb');
if ($stream === false) answer(400, ['ok' => false, 'error' => 'Request body unavailable']);
$raw = stream_get_contents($stream, 32769);
fclose($stream);
if ($raw === false || strlen($raw) > 32768) answer(413, ['ok' => false, 'error' => 'Report too large']);
$report = json_decode($raw, true);
if (!is_array($report) || ($report['schema'] ?? null) !== 1
    || ($report['application'] ?? null) !== 'bmrmodz-data-diagnostics'
    || !isset($report['results']) || !is_array($report['results'])
    || count($report['results']) > 32) {
    answer(422, ['ok' => false, 'error' => 'Invalid report']);
}
foreach ($report['results'] as $item) {
    if (!is_array($item) || !is_string($item['id'] ?? null)
        || !preg_match('/^[a-zA-Z0-9_-]{1,30}$/', $item['id'])
        || !in_array(($item['status'] ?? ''), ['PASS', 'FAIL', 'SKIP'], true)
        || !is_string($item['detail'] ?? null) || strlen($item['detail']) > 160) {
        answer(422, ['ok' => false, 'error' => 'Invalid result']);
    }
}
$allow = ['schema', 'application', 'runMode', 'startedAt', 'finishedAt', 'totals',
          'results', 'controlsTested', 'signalPermissionsVerified', 'deviceVerified', 'notes'];
foreach ($report as $key => $value) {
    if (!in_array($key, $allow, true)) answer(422, ['ok' => false, 'error' => 'Unknown report field']);
}
// Block accidental identifiers even if the client is modified.
if (preg_match('/"\\s*(vin|gps|latitude|longitude|vehicleOrder|rawUds|credentials|token)\\s*"/i', $raw)) {
    answer(422, ['ok' => false, 'error' => 'Sensitive field present']);
}
$id = bin2hex(random_bytes(12));
$file = rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . $id . '.json';
$sanitized = json_encode($report, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
if ($sanitized === false || file_put_contents($file, $sanitized . "\n", LOCK_EX) === false) {
    answer(500, ['ok' => false, 'error' => 'Storage error']);
}
@chmod($file, 0600);
answer(201, ['ok' => true, 'id' => $id]);
