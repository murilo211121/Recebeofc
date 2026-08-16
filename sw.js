/* =====================================================================
   SERVICE WORKER — RecebeMais
   Estratégia "offline-first": os arquivos do próprio app (HTML, ícones)
   ficam em cache e carregam mesmo sem internet. Chamadas para o
   Firebase/Firestore (nuvem) NUNCA passam pelo cache — sempre tentam
   rede de verdade, já que fazem sentido só quando há conexão.
   ===================================================================== */

const CACHE_NAME = "recebemais-cache-v1";
const ARQUIVOS_PARA_CACHE = [
  "./recebemais.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// Domínios que NUNCA devem ser servidos pelo cache — precisam sempre de
// rede de verdade (Firebase Auth, Firestore, CDNs de bibliotecas).
const DOMINIOS_SEMPRE_REDE = [
  "firestore.googleapis.com",
  "firebaseapp.com",
  "googleapis.com",
  "gstatic.com",
  "cloudinary.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // usa addAll com tolerância a falha individual, para um ícone
      // faltando não impedir o resto do cache de funcionar
      return Promise.all(
        ARQUIVOS_PARA_CACHE.map((url) =>
          cache.add(url).catch((err) => console.warn("Falha ao cachear", url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // nunca intercepta chamadas de nuvem — deixa ir direto pra rede
  if (DOMINIOS_SEMPRE_REDE.some((dominio) => url.hostname.includes(dominio))){
    return;
  }

  // para os arquivos do próprio app: tenta a rede primeiro (pega
  // atualização quando online), cai pro cache se estiver offline
  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        // atualiza o cache com a versão mais recente sempre que consegue
        // buscar da rede com sucesso
        const respostaClone = resposta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respostaClone));
        return resposta;
      })
      .catch(() => caches.match(event.request))
  );
});
