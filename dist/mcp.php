<?php
/* Endpoint MCP in sola lettura (JSON-RPC 2.0 su HTTP) per il sito del Dott. Umberto Fama.
   Strumenti: cerca_pagine, leggi_pagina, elenco_sezioni. Risorse: llms.txt, ai-catalog.json.
   Usa solo i file statici del sito (ai-catalog.json e i file index.md delle pagine). */
declare(strict_types=1);
const MCP_VER = '2025-06-18';
const BASE = 'https://www.dottorfamaumberto.it';
$root = __DIR__;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: content-type, accept, mcp-protocol-version, mcp-session-id');
header('Access-Control-Expose-Headers: mcp-protocol-version');
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($metodo === 'OPTIONS') { http_response_code(204); exit; }
if ($metodo !== 'POST') {
  http_response_code(405); header('Allow: POST, OPTIONS'); header('Content-Type: text/plain; charset=utf-8');
  echo "Usare POST con messaggi JSON-RPC (MCP streamable HTTP, senza stream SSE)"; exit;
}

function catalogo(): array { static $c = null; if ($c === null) { $c = json_decode((string)@file_get_contents(__DIR__ . '/ai-catalog.json'), true) ?: ['sections' => []]; } return $c; }
function norm(string $s): string {
  $s = mb_strtolower($s, 'UTF-8');
  if (class_exists('Normalizer')) { $s = preg_replace('/\p{Mn}/u', '', Normalizer::normalize($s, Normalizer::FORM_D)); }
  else { $s = strtr($s, ['à'=>'a','á'=>'a','è'=>'e','é'=>'e','ì'=>'i','í'=>'i','ò'=>'o','ó'=>'o','ù'=>'u','ú'=>'u']); }
  return $s;
}
function strumenti(): array {
  $sola = ['readOnlyHint' => true, 'openWorldHint' => false];
  return [
    ['name' => 'cerca_pagine', 'title' => 'Cerca nel sito', 'description' => 'Cerca tra le pagine del sito (trattamenti, sedi, blog, informazioni) per parole chiave nel titolo e nella descrizione. Restituisce titolo, indirizzo e descrizione delle pagine trovate.',
     'inputSchema' => ['type' => 'object', 'properties' => ['query' => ['type' => 'string', 'description' => 'Parole da cercare, ad esempio: blefaroplastica, Aprilia, laser'], 'max' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 30, 'description' => 'Numero massimo di risultati (predefinito 10)']], 'required' => ['query'], 'additionalProperties' => false], 'annotations' => $sola],
    ['name' => 'leggi_pagina', 'title' => 'Leggi una pagina', 'description' => 'Restituisce il contenuto di una pagina del sito in formato Markdown, dato il suo percorso (ad esempio /blefaroplastica-roma-aprilia/ o /contatti/).',
     'inputSchema' => ['type' => 'object', 'properties' => ['path' => ['type' => 'string', 'description' => 'Percorso della pagina sul sito, che inizia con /']], 'required' => ['path'], 'additionalProperties' => false], 'annotations' => $sola],
    ['name' => 'elenco_sezioni', 'title' => 'Sezioni del sito', 'description' => 'Elenca le sezioni del sito (aree di trattamento, sedi, blog, pagine informative) con le relative pagine.',
     'inputSchema' => ['type' => 'object', 'properties' => new stdClass(), 'additionalProperties' => false], 'annotations' => $sola],
  ];
}
function testo(string $t, bool $err = false): array { $r = ['content' => [['type' => 'text', 'text' => $t]]]; if ($err) $r['isError'] = true; return $r; }
function chiama(string $nome, array $a): ?array {
  if ($nome === 'cerca_pagine') {
    $parole = array_values(array_filter(preg_split('/\s+/u', norm((string)($a['query'] ?? ''))) ?: []));
    $max = max(1, min(30, (int)($a['max'] ?? 10))); $out = [];
    foreach (catalogo()['sections'] as $s) foreach ($s['pages'] as $p) {
      $t = norm($p['title'] . ' ' . ($p['description'] ?? '') . ' ' . $s['name'] . ' ' . $p['url']); $ok = (bool)$parole;
      foreach ($parole as $w) if (mb_strpos($t, $w) === false) { $ok = false; break; }
      if ($ok) $out[] = '- [' . $p['title'] . '](' . $p['url'] . ') (' . $s['name'] . ')' . (!empty($p['description']) ? ': ' . $p['description'] : '');
    }
    return testo($out ? implode("\n", array_slice($out, 0, $max)) : 'Nessuna pagina trovata per: ' . (string)($a['query'] ?? ''));
  }
  if ($nome === 'leggi_pagina') {
    $path = (string)(parse_url((string)($a['path'] ?? '/'), PHP_URL_PATH) ?? '/');
    $path = '/' . trim(preg_replace('#/+#', '/', $path), '/'); $path = $path === '/' ? '/' : $path . '/';
    if (strpos($path, '..') !== false || !preg_match('#^/[a-z0-9/\-]*$#', $path)) return testo('Percorso non valido: ' . $path, true);
    $f = __DIR__ . $path . 'index.md';
    return is_file($f) ? testo((string)file_get_contents($f)) : testo('Pagina non trovata: ' . $path, true);
  }
  if ($nome === 'elenco_sezioni') {
    $b = [];
    foreach (catalogo()['sections'] as $s) { $r = '## ' . $s['name']; foreach ($s['pages'] as $p) $r .= "\n- [" . $p['title'] . '](' . $p['url'] . ')'; $b[] = $r; }
    return testo(implode("\n\n", $b));
  }
  return null;
}
function risorse(): array {
  return [
    ['uri' => BASE . '/llms.txt', 'name' => 'llms.txt', 'title' => 'Indice del sito per agenti', 'mimeType' => 'text/plain', 'description' => 'Elenco ragionato delle pagine del sito in formato llms.txt'],
    ['uri' => BASE . '/ai-catalog.json', 'name' => 'ai-catalog', 'title' => 'Catalogo del sito', 'mimeType' => 'application/json', 'description' => 'Sezioni e pagine del sito in formato JSON'],
  ];
}
function gestisci($m) {
  if (!is_array($m) || ($m['jsonrpc'] ?? '') !== '2.0' || !is_string($m['method'] ?? null)) return ['jsonrpc' => '2.0', 'id' => $m['id'] ?? null, 'error' => ['code' => -32600, 'message' => 'Richiesta non valida']];
  if (!array_key_exists('id', $m) || $m['id'] === null) return null; // notifica
  $ok = fn($r) => ['jsonrpc' => '2.0', 'id' => $m['id'], 'result' => $r];
  $ko = fn($c, $t) => ['jsonrpc' => '2.0', 'id' => $m['id'], 'error' => ['code' => $c, 'message' => $t]];
  $par = is_array($m['params'] ?? null) ? $m['params'] : [];
  switch ($m['method']) {
    case 'initialize': return $ok(['protocolVersion' => MCP_VER, 'capabilities' => ['tools' => ['listChanged' => false], 'resources' => ['listChanged' => false]], 'serverInfo' => ['name' => 'dottorfama-sito', 'title' => 'Sito del Dott. Umberto Fama', 'version' => '1.0.0'], 'instructions' => 'Server in sola lettura sul sito del Dott. Umberto Fama (chirurgo plastico, Roma e Aprilia). Permette di cercare e leggere le pagine pubbliche; non prenota visite e non raccoglie dati personali.']);
    case 'ping': return $ok(new stdClass());
    case 'tools/list': return $ok(['tools' => strumenti()]);
    case 'tools/call': $r = chiama((string)($par['name'] ?? ''), is_array($par['arguments'] ?? null) ? $par['arguments'] : []); return $r ? $ok($r) : $ko(-32602, 'Strumento sconosciuto: ' . (string)($par['name'] ?? ''));
    case 'resources/list': return $ok(['resources' => risorse()]);
    case 'resources/templates/list': return $ok(['resourceTemplates' => []]);
    case 'prompts/list': return $ok(['prompts' => []]);
    case 'resources/read':
      $uri = (string)($par['uri'] ?? '');
      $map = [BASE . '/llms.txt' => ['llms.txt', 'text/plain'], BASE . '/ai-catalog.json' => ['ai-catalog.json', 'application/json']];
      return isset($map[$uri]) ? $ok(['contents' => [['uri' => $uri, 'mimeType' => $map[$uri][1], 'text' => (string)file_get_contents(__DIR__ . '/' . $map[$uri][0])]]]) : $ko(-32002, 'Risorsa non trovata: ' . $uri);
    default: return $ko(-32601, 'Metodo non supportato: ' . $m['method']);
  }
}
$body = json_decode((string)file_get_contents('php://input'), true);
if ($body === null) { http_response_code(400); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32700, 'message' => 'JSON non valido']]); exit; }
$batch = is_array($body) && array_is_list($body);
$risposte = array_values(array_filter(array_map('gestisci', $batch ? $body : [$body]), fn($x) => $x !== null));
if (!$risposte) { http_response_code(202); exit; }
header('Content-Type: application/json; charset=utf-8'); header('MCP-Protocol-Version: ' . MCP_VER); header('Cache-Control: no-store');
echo json_encode($batch ? $risposte : $risposte[0], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
