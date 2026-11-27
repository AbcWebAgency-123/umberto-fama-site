<?php
declare(strict_types=1);
date_default_timezone_set('Europe/Rome');

/* Aggiorna dist/data/miodottore.json con voto medio e numero di recensioni del profilo MioDottore,
   letti dal JSON-LD (aggregateRating) della pagina pubblica del profilo.
   Dopo questo script, tools/applica-recensioni.py riporta numero e data nelle pagine HTML e .md.
   Lo esegue ogni giorno il workflow .github/workflows/aggiorna-recensioni.yml; si può lanciare anche a mano:
     php tools/aggiorna-miodottore.php [percorso-del-json]
   In caso di errore lascia il file precedente com'è. */

// Consente l'esecuzione solo da riga di comando (cron / terminale / GitHub Actions)
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Accesso negato.');
}

// --- CONFIGURAZIONE ---
$profileUrl = getenv('MIODOTTORE_URL') ?: 'https://www.miodottore.it/umberto-fama-2';
$cacheFile  = $argv[1] ?? __DIR__ . '/../dist/data/miodottore.json';
$timeout    = 15;

/**
 * Cerca ricorsivamente il nodo aggregateRating dentro un array JSON-LD.
 */
function findAggregateRating(array $data): ?array
{
    if (
        isset($data['aggregateRating']['ratingValue'], $data['aggregateRating']['reviewCount'])
    ) {
        return [
            'ratingValue' => (float) str_replace(',', '.', (string) $data['aggregateRating']['ratingValue']),
            'reviewCount' => (int) $data['aggregateRating']['reviewCount'],
        ];
    }

    foreach ($data as $value) {
        if (is_array($value)) {
            $found = findAggregateRating($value);
            if ($found !== null) {
                return $found;
            }
        }
    }

    return null;
}

// 1. Download della pagina con cURL
$ch = curl_init($profileUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 3,
    CURLOPT_TIMEOUT        => $timeout,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_ENCODING       => '', // Gestisce automaticamente gzip/deflate/br
    CURLOPT_HTTPHEADER     => [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language: it-IT,it;q=0.9,en;q=0.8',
        'Cache-Control: no-cache',
    ],
]);

$html     = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($html === false || $httpCode !== 200) {
    fwrite(STDERR, sprintf("[%s] Errore HTTP %d (%s). Cache precedente mantenuta.\n", date('c'), $httpCode, $curlErr ?: 'nessun dettaglio'));
    exit(0); // Exit 0 per non generare errori continui nel cron se il blocco è temporaneo
}

// 2. Estrazione dei blocchi JSON-LD
preg_match_all(
    '/<script[^>]*type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is',
    $html,
    $matches
);

$ratingData = null;

foreach ($matches[1] ?? [] as $rawJson) {
    $decoded = json_decode(trim($rawJson), true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $ratingData = findAggregateRating($decoded);
        if ($ratingData !== null) {
            break;
        }
    }
}

// 3. Validazione (fallback: se i dati non sono validi, non sovrascrive la cache)
if (
    $ratingData === null ||
    $ratingData['reviewCount'] < 1 ||
    $ratingData['ratingValue'] <= 0 ||
    $ratingData['ratingValue'] > 5
) {
    fwrite(STDERR, sprintf("[%s] aggregateRating non trovato o non valido. Cache precedente mantenuta.\n", date('c')));
    exit(0);
}

// 4. Salvataggio atomico del file JSON
$payload = [
    'ratingValue' => round($ratingData['ratingValue'], 1),
    'reviewCount' => $ratingData['reviewCount'],
    'profileUrl'  => $profileUrl,
    'updatedAt'   => date('c'),
];

// Se voto e numero non sono cambiati il file resta com'è: niente commit e deploy inutili
$previous = is_file($cacheFile) ? json_decode((string) file_get_contents($cacheFile), true) : null;
if (
    is_array($previous) &&
    (float) ($previous['ratingValue'] ?? 0) === (float) $payload['ratingValue'] &&
    (int) ($previous['reviewCount'] ?? 0) === $payload['reviewCount']
) {
    fwrite(STDOUT, sprintf("[%s] Nessuna variazione: %.1f/5 (%d recensioni)\n", date('c'), $payload['ratingValue'], $payload['reviewCount']));
    exit(0);
}

$cacheDir = dirname($cacheFile);
if (!is_dir($cacheDir) && !mkdir($cacheDir, 0755, true)) {
    fwrite(STDERR, sprintf("[%s] Impossibile creare la cartella %s\n", date('c'), $cacheDir));
    exit(1);
}

$tmpFile = $cacheFile . '.tmp';
$json    = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";

if (file_put_contents($tmpFile, $json, LOCK_EX) === false || !rename($tmpFile, $cacheFile)) {
    @unlink($tmpFile);
    fwrite(STDERR, sprintf("[%s] Errore scrittura file di cache.\n", date('c')));
    exit(1);
}

fwrite(STDOUT, sprintf(
    "[%s] Cache aggiornata: %.1f/5 (%d recensioni)\n",
    date('c'),
    $payload['ratingValue'],
    $payload['reviewCount']
));
