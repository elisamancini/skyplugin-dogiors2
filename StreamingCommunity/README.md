# 🌌 StreamingCommunity SkyStream Plugin (Sky Gen 2)

Plugin ufficiale per **[SkyStream](https://github.com/akashdh11/skystream)** convertito dal plugin CloudStream originale (`it.dogior.hadEnough.StreamingCommunity`).
Conforme rigorosamente alla specifica **Sky Gen 2 Architecture** e **skystream-tools**.

---

## 🌟 Caratteristiche

- ✅ **Dashboard SkyStream Nativa**: Categoria riservata `"Trending"` per l'Hero Carousel dinamico + sezioni thumbnail `"Top 10 Oggi"` e `"Ultime Uscite"`.
- ✅ **Ricerca Veloce**: Supporto per query di film e serie TV con risultati completi di poster, anno e valutazione.
- ✅ **Scheda Dettagli Completa**:
  - Locandina verticale ad alta risoluzione & Backdrop
  - Trama, voto medio, anno e classificazione d'età (es. `16+`)
  - Generi e Cast attori (`Actor`)
  - Trailer YouTube integrati (`Trailer`)
  - Titoli consigliati correlati (`recommendations`)
  - Suddivisione per Stagioni ed Episodi con durata, titolo e cover
  - Metadati ID esterni (`syncData`: TMDB e IMDb)
- ✅ **Estrattore Video VixCloud Diretto**: Risoluzione del token di sicurezza e generazione del master playlist HLS M3U8 (`1080p FHD` / `720p HD`).
- ✅ **Mirror Domains Multipli**: Supporto nativo ai domini alternativi configurabili dal menu impostazioni dell'app SkyStream senza modificare il codice (`manifest.baseUrl`).
- ✅ **Pacchetto `.sky` & `dist/` Precompilati**: Include `dist/plugins.json`, `dist/it.dogior.streamingcommunity.sky` e `plugins.json` alla radice.

---

## 📦 Struttura del Repository (Sky Gen 2 Hub)

```
streamingcommunity-skystream/
├── repo.json                                 # Descrittore Repository Hub SkyStream
├── plugins.json                              # Catalogo plugin alla radice del repository
├── README.md                                 # Guida installazione e documentazione
├── dist/
│   ├── plugins.json                          # Catalogo puntato da repo.json con gli URL dei pacchetti .sky
│   └── it.dogior.streamingcommunity.sky      # Pacchetto ZIP compresso contenente plugin.json + plugin.js
└── StreamingCommunity/
    ├── plugin.json                           # Manifest plugin conforme a pluginSchema
    ├── plugin.js                             # Codice JavaScript eseguibile nella sandbox
    ├── plugin.ts                             # Sorgente TypeScript con tipi ufficiali SDK
    └── types.d.ts                            # Tipi ufficiali SkyStream SDK
```

---

## 🚀 Come Installare in SkyStream

### Metodo 1: Aggiungi Sorgente via URL Repository (Consigliato)
1. Apri **SkyStream** sul tuo dispositivo (Android, TV o Desktop).
2. Vai su **Impostazioni (Settings)** > **Estensioni (Manage Extensions)**.
3. Clicca su **Aggiungi Sorgente (Add Source)** o **Aggiungi Repository**.
4. Incolla l'URL del file `repo.json`:
   ```
   https://raw.githubusercontent.com/doGior/skystream-streamingcommunity/main/repo.json
   ```
5. Conferma e installa **StreamingCommunity** dalla lista delle estensioni disponibili!

### Metodo 2: Compilazione o Deploy con SkyStream CLI
```bash
# 1. Installa la CLI SkyStream
npm install -g skystream-cli

# 2. Testa le funzioni del plugin
skystream test -f getHome
skystream test -f search -q "Matrix"
skystream test -f load -q "https://streamingunity.fun/it/titles/1994-matrix"
skystream test -f loadStreams -q "https://streamingunity.fun/it/iframe/1994?canPlayFHD=1"

# 3. Valida il manifest e le esportazioni
skystream validate

# 4. Distribuisci il pacchetto generando la cartella dist/ con plugins.json e .sky
skystream deploy -u https://raw.githubusercontent.com/TUO_UTENTE/TUO_REPO/main/
```

---

## ⚙️ Cambio Dominio & Mirror

StreamingCommunity offre molteplici domini mirror per aggirare blocchi di rete o censure DNS.
Nelle impostazioni dell'estensione (icona ingranaggio ⚙️ in SkyStream), puoi selezionare:
- `streamingunity.fun` (Default)
- `streamingcommunity.computer`
- `streamingunity.biz`
- `streamingcommunity.buzz`
- `streamingcommunity.express`

SkyStream inietterà automaticamente il dominio selezionato nella variabile globale `manifest.baseUrl`.

---

## ⚖️ Mappatura Modelli CloudStream ➔ SkyStream

| CloudStream (Kotlin) | SkyStream (JavaScript/TS) | Note |
|---|---|---|
| `MainAPI.mainPage` | `globalThis.getHome(cb)` | Restituisce `{ "Trending": [...], "Top 10": [...] }` |
| `MainAPI.search` | `globalThis.search(query, cb)` | Restituisce array di `MultimediaItem` |
| `MainAPI.load` | `globalThis.load(url, cb)` | Restituisce `MultimediaItem` con `episodes` |
| `MainAPI.loadLinks` | `globalThis.loadStreams(url, cb)` | Restituisce array di `StreamResult` (M3U8) |
| `TvType.Movie` / `TvType.TvSeries` | `item.type = 'movie'` / `'series'` | Tipo nativo SkyStream |
| `Episode` | `new Episode({ name, url, season, episode })` | Classe nativa SkyStream |
| `ExtractorLink` | `new StreamResult({ url, source, headers })` | Master playlist HLS |
| `VixCloudExtractor` | Parser script `window.masterPlaylist` | Genera token ed expires m3u8 |
