<?php
/* Modulo contatti del sito del Dott. Umberto Fama (pagina /contatti/).
   Riceve il POST del modulo, controlla i campi e invia la richiesta per e-mail alla segreteria
   con la funzione mail() dell'hosting Aruba (PHP 8.1 o superiore).
   Risponde in JSON quando il browser lo chiede (invio con fetch da site.js),
   altrimenti reindirizza a /grazie/ (invio classico senza JavaScript). */
declare(strict_types=1);
date_default_timezone_set('Europe/Rome');

/* ---- Configurazione ---- */
const DESTINATARIO = 'umbertofama65@gmail.com';        // dove arrivano le richieste
const MITTENTE     = 'noreply@dottorfamaumberto.it';    // casella del dominio ospitato su Aruba
const NOME_SITO    = 'Sito Dott. Umberto Fama';
const PAGINA_OK    = '/grazie/';
const PAGINA_MODULO = '/contatti/#form-contatti';
const MAX_INVII_ORA = 5;                                // invii massimi per indirizzo IP in un'ora

/* ---- Risposte ---- */
$vuoleJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function rispondi(int $codice, string $messaggio, bool $json): never {
  http_response_code($codice);
  header('Cache-Control: no-store');
  header('X-Robots-Tag: noindex');
  if ($json) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => $codice < 400, 'messaggio' => $messaggio], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if ($codice < 400) { header('Location: ' . PAGINA_OK, true, 303); exit; }
  header('Content-Type: text/html; charset=utf-8');
  $m = htmlspecialchars($messaggio, ENT_QUOTES, 'UTF-8');
  echo '<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
     . '<title>Richiesta non inviata | Dott. Umberto Fama</title>'
     . '<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#173d37">'
     . '<h1>Richiesta non inviata</h1><p>' . $m . '</p>'
     . '<p><a href="' . PAGINA_MODULO . '">Torna al modulo</a> oppure chiami la segreteria al <a href="tel:+393205676353">320 5676353</a>.</p></body></html>';
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  header('Allow: POST');
  rispondi(405, 'Il modulo va inviato dalla pagina Contatti.', $vuoleJson);
}

/* ---- Lettura e pulizia dei campi ---- */
function campo(string $nome, int $max): string {
  $v = $_POST[$nome] ?? '';
  if (!is_string($v)) return '';
  $v = str_replace("\0", '', $v);
  $v = preg_replace('/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
  $v = trim($v);
  return mb_substr($v, 0, $max, 'UTF-8');
}
function una_riga(string $v): string { return trim(preg_replace('/\s+/u', ' ', $v) ?? ''); }

/* Campo trappola: invisibile alle persone, i programmi automatici lo riempiono.
   Si risponde come se fosse andato tutto bene, senza inviare nulla. */
if (campo('sito_web', 200) !== '') rispondi(200, 'Richiesta ricevuta.', $vuoleJson);

$nome        = una_riga(campo('nome', 80));
$cognome     = una_riga(campo('cognome', 80));
$telefono    = una_riga(campo('telefono', 40));
$email       = una_riga(campo('email', 160));
$trattamento = una_riga(campo('trattamento', 120));
$sede        = una_riga(campo('sede', 40));
$messaggio   = campo('messaggio', 4000);
$consenso    = campo('consenso', 4);

$errori = [];
if ($nome === '')    $errori[] = 'il nome';
if ($cognome === '') $errori[] = 'il cognome';
if (strlen(preg_replace('/\D/', '', $telefono) ?? '') < 6) $errori[] = 'un numero di telefono valido';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))            $errori[] = 'un indirizzo e-mail valido';
if ($consenso !== 'si') $errori[] = 'il consenso al trattamento dei dati';
if ($errori) rispondi(422, 'Manca ' . implode(', ', $errori) . '.', $vuoleJson);

$sedi = ['' => 'Indifferente', 'Parioli' => 'Roma Flaminio / Parioli', 'Centocelle' => 'Roma Centocelle / Prenestina', 'EUR' => 'Roma EUR', 'Aprilia' => 'Aprilia'];
$sede = $sedi[$sede] ?? 'Indifferente';

/* ---- Limite di invii per indirizzo IP ---- */
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$fileLimite = sys_get_temp_dir() . '/fama_modulo_' . hash('sha256', $ip . __FILE__) . '.json';
$adesso = time();
$invii = array_values(array_filter(
  json_decode((string)@file_get_contents($fileLimite), true) ?: [],
  fn($t) => is_int($t) && $t > $adesso - 3600
));
if (count($invii) >= MAX_INVII_ORA) rispondi(429, 'Sono già state inviate diverse richieste da questa connessione. Riprovi più tardi.', $vuoleJson);

/* ---- Composizione e invio dell'e-mail ---- */
$oggetto = 'Richiesta di visita dal sito: ' . $nome . ' ' . $cognome;
$corpo = "Nuova richiesta dal modulo contatti del sito.\n\n"
       . "Nome:        $nome\n"
       . "Cognome:     $cognome\n"
       . "Telefono:    $telefono\n"
       . "E-mail:      $email\n"
       . "Trattamento: " . ($trattamento !== '' ? $trattamento : 'Non so ancora, vorrei un consiglio') . "\n"
       . "Sede:        $sede\n\n"
       . "Messaggio:\n" . ($messaggio !== '' ? $messaggio : '(nessun messaggio)') . "\n\n"
       . "Consenso privacy: sì\n"
       . 'Inviata il ' . date('d/m/Y \a\l\l\e H:i') . ' da IP ' . $ip . "\n";

$intestazioni = [
  'From'                      => '=?UTF-8?B?' . base64_encode(NOME_SITO) . '?= <' . MITTENTE . '>',
  'Reply-To'                  => $email,          // validato da FILTER_VALIDATE_EMAIL: niente a capo
  'MIME-Version'              => '1.0',
  'Content-Type'              => 'text/plain; charset=UTF-8',
  'Content-Transfer-Encoding' => '8bit',
  'X-Mailer'                  => 'dottorfamaumberto.it',
];
$oggettoCodificato = '=?UTF-8?B?' . base64_encode($oggetto) . '?=';

$inviata = mail(DESTINATARIO, $oggettoCodificato, $corpo, $intestazioni, '-f' . MITTENTE);
if (!$inviata) {
  error_log('invia.php: mail() non riuscita per la richiesta di ' . $email);
  rispondi(500, 'Non è stato possibile inviare la richiesta in questo momento.', $vuoleJson);
}

$invii[] = $adesso;
@file_put_contents($fileLimite, json_encode($invii), LOCK_EX);

rispondi(200, 'Richiesta inviata.', $vuoleJson);
