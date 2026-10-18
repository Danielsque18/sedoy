<?php
// API админ-панели SEDOY. Работает на обычном PHP-хостинге (Beget, Timeweb), PHP 7.4+ с GD.
declare(strict_types=1);

const ROOT = __DIR__ . '/..';
const CONTENT = ROOT . '/data/content.json';
const BACKUPS = ROOT . '/data/backups';
const PRIVATE_DIR = ROOT . '/data/private';
const UPLOADS = ROOT . '/img/uploads';
const KEEP_BACKUPS = 30;
const MAX_JSON = 2 * 1024 * 1024;
const MAX_UPLOAD = 12 * 1024 * 1024;
const MAX_SIDE = 1600;

date_default_timezone_set('Asia/Omsk'); // время сохранений и резервных копий — омское
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('sedoy_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'secure' => $https, 'samesite' => 'Strict']);
session_start();

function out(array $data, int $code = 200): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code = 400): void { out(['ok' => false, 'error' => $msg], $code); }
function cfg(): array { return require __DIR__ . '/config.php'; }
function authed(): bool { return !empty($_SESSION['auth']) && ($_SESSION['ua'] ?? '') === ($_SERVER['HTTP_USER_AGENT'] ?? ''); }
function need_auth(): void {
    if (!authed()) fail('Нужно войти', 401);
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Только POST', 405);
    if (!hash_equals($_SESSION['csrf'] ?? '', $_SERVER['HTTP_X_CSRF'] ?? '')) fail('Сессия устарела, войдите заново', 403);
}
// content.json для сайта и content.js — копия, чтобы сайт открывался и без сервера
function write_content(array $data): void {
    $tmp = CONTENT . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    rename($tmp, CONTENT);
    $js = ROOT . '/data/content.js';
    file_put_contents($js . '.tmp', "// Копия content.json — чтобы сайт открывался и без сервера. Админка обновляет её сама.\nwindow.SEDOY_SEED = " . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . ";\n", LOCK_EX);
    rename($js . '.tmp', $js);
}
function write_password(string $plain): void {
    $hash = password_hash($plain, PASSWORD_DEFAULT);
    file_put_contents(__DIR__ . '/config.php', "<?php\n// Пароль админки (хранится только хеш). Менять через «Настройки» в админке.\nreturn ['password_hash' => " . var_export($hash, true) . ", 'initial_password' => ''];\n", LOCK_EX);
}
function ensure_dirs(): void {
    foreach ([BACKUPS, PRIVATE_DIR] as $d) {
        if (!is_dir($d)) mkdir($d, 0755, true);
        // закрыть папку и на новом, и на старом Apache (Deny без нужного модуля даёт ошибку 500)
        if (!file_exists("$d/.htaccess")) file_put_contents("$d/.htaccess", "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n");
    }
    if (!is_dir(UPLOADS)) mkdir(UPLOADS, 0755, true);
    // в папке загрузок отдаём только .jpg. php_flag — только если PHP работает модулем Apache, иначе он сам ломает папку (ошибка 500)
    if (!file_exists(UPLOADS . '/.htaccess')) file_put_contents(UPLOADS . '/.htaccess', "<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\n<IfModule mod_php7.c>\nphp_flag engine off\n</IfModule>\nRemoveHandler .php .phtml .php5 .php7 .php8 .phar\n<FilesMatch \"\\.(?!jpe?g$)[^.]+$\">\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n</FilesMatch>\n");
}

// ---- защита от подбора пароля: 8 ошибок с одного IP → пауза 15 минут
function attempts_file(): string { return PRIVATE_DIR . '/attempts.json'; }
function attempts(): array { $f = attempts_file(); return is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : []; }
function save_attempts(array $a): void { file_put_contents(attempts_file(), json_encode($a), LOCK_EX); }

$action = $_GET['action'] ?? '';
ensure_dirs();

switch ($action) {
case 'ping':
    out(['ok' => true, 'php' => true]);

case 'me':
    out(['ok' => true, 'auth' => authed(), 'csrf' => authed() ? $_SESSION['csrf'] : null]);

case 'login':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Только POST', 405);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '?';
    $a = attempts();
    $rec = $a[$ip] ?? ['n' => 0, 't' => 0];
    if ($rec['n'] >= 8 && time() - $rec['t'] < 900) fail('Слишком много попыток. Попробуйте через 15 минут', 429);
    $body = json_decode((string)file_get_contents('php://input'), true) ?: [];
    $pass = (string)($body['password'] ?? '');
    $c = cfg();
    $ok = $c['password_hash'] !== ''
        ? password_verify($pass, $c['password_hash'])
        : ($c['initial_password'] !== '' && hash_equals($c['initial_password'], $pass));
    if ($ok && $c['password_hash'] === '') write_password($pass);
    if (!$ok) {
        $a[$ip] = ['n' => ($rec['n'] >= 8 ? 0 : $rec['n']) + 1, 't' => time()];
        save_attempts($a);
        usleep(700000);
        fail('Неверный пароль', 401);
    }
    unset($a[$ip]); save_attempts($a);
    session_regenerate_id(true);
    $_SESSION['auth'] = true;
    $_SESSION['ua'] = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $_SESSION['csrf'] = bin2hex(random_bytes(24));
    out(['ok' => true, 'csrf' => $_SESSION['csrf']]);

case 'logout':
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);

case 'save':
    need_auth();
    $raw = (string)file_get_contents('php://input');
    if (strlen($raw) > MAX_JSON) fail('Слишком большой файл');
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['brand'], $data['services'], $data['masters'])) fail('Данные повреждены, ничего не сохранено');
    if (is_file(CONTENT)) copy(CONTENT, BACKUPS . '/content-' . date('Y-m-d_H-i-s') . '.json');
    $list = glob(BACKUPS . '/content-*.json') ?: [];
    sort($list);
    while (count($list) > KEEP_BACKUPS) unlink(array_shift($list));
    write_content($data);
    out(['ok' => true, 'saved' => date('H:i')]);

case 'upload':
    need_auth();
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) fail('Файл не загрузился');
    if ($f['size'] > MAX_UPLOAD) fail('Файл больше 12 МБ');
    $info = @getimagesize($f['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) fail('Нужна картинка JPG, PNG или WebP');
    $src = $info[2] === IMAGETYPE_JPEG ? @imagecreatefromjpeg($f['tmp_name'])
         : ($info[2] === IMAGETYPE_PNG ? @imagecreatefrompng($f['tmp_name']) : @imagecreatefromwebp($f['tmp_name']));
    if (!$src) fail('Не удалось прочитать картинку');
    [$w, $h] = [imagesx($src), imagesy($src)];
    $k = min(1, MAX_SIDE / max($w, $h));
    $nw = (int)round($w * $k); $nh = (int)round($h * $k);
    $dst = imagecreatetruecolor($nw, $nh);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    $name = date('Ymd') . '-' . bin2hex(random_bytes(6)) . '.jpg';
    imagejpeg($dst, UPLOADS . '/' . $name, 84);
    imagedestroy($src); imagedestroy($dst);
    out(['ok' => true, 'path' => 'img/uploads/' . $name]);

case 'backups':
    need_auth();
    $list = glob(BACKUPS . '/content-*.json') ?: [];
    rsort($list);
    out(['ok' => true, 'items' => array_map(fn($p) => ['name' => basename($p), 'size' => filesize($p)], $list)]);

case 'restore':
    need_auth();
    $body = json_decode((string)file_get_contents('php://input'), true) ?: [];
    $name = (string)($body['name'] ?? '');
    if (!preg_match('/^content-[\d_-]+\.json$/', $name) || !is_file(BACKUPS . "/$name")) fail('Копия не найдена');
    $data = json_decode((string)file_get_contents(BACKUPS . "/$name"), true);
    if (!is_array($data) || !isset($data['brand'], $data['services'], $data['masters'])) fail('Копия повреждена, ничего не изменено');
    copy(CONTENT, BACKUPS . '/content-' . date('Y-m-d_H-i-s') . '.json');
    write_content($data);
    out(['ok' => true]);

case 'password':
    need_auth();
    $body = json_decode((string)file_get_contents('php://input'), true) ?: [];
    if (!password_verify((string)($body['old'] ?? ''), cfg()['password_hash'])) fail('Старый пароль неверный');
    $new = (string)($body['new'] ?? '');
    if (mb_strlen($new) < 8) fail('Новый пароль — минимум 8 символов');
    write_password($new);
    out(['ok' => true]);

default:
    fail('Неизвестное действие', 404);
}
